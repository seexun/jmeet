import { AsrJobModel, MeetingSessionModel } from '../models/mongoose-schemas/meeting-session.schema.js';

interface LeaseReleaseLogger {
	info: (message: string) => void;
	warn: (message: string) => void;
}

/**
 * Gibt die aktiven ASR-Leases eines Raums sofort frei (Status 'completed').
 *
 * Hintergrund: Wird der Untertitel-Agent gestoppt (Teilnehmer schaltet Untertitel
 * aus, letzter Zuschauer geht, Raum endet), terminiert der zugehörige Agent-Job,
 * aber seine Lease kann noch 'running' mit frischem Heartbeat sein. Fordert ein
 * neues Agent-Job den Kontext an, bekommt es 409 und gibt stillschweigend auf —
 * bis zu 45 Sekunden lang (Heartbeat-Stale-Fenster). Das sofortige Freigeben
 * ermöglicht das erneute Leasen im 'completed'-Zweig von getRoomContext.
 *
 * Bewusst als Leaf-Util (nur Modell-Importe): Der Ai-Assistant-Service darf den
 * Recovery-Service nicht statisch importieren (Zyklus über Task-Scheduler).
 */
export async function releaseActiveAsrLeases(roomId: string, logger: LeaseReleaseLogger): Promise<void> {
	const sessions = await MeetingSessionModel.find(
		{ roomId, status: { $in: ['starting', 'active'] } },
		{ meetingSessionId: 1 }
	).lean().exec();
	if (!sessions.length) return;

	const now = Date.now();
	const result = await AsrJobModel.updateMany(
		{
			meetingSessionId: { $in: sessions.map((session) => session.meetingSessionId) },
			status: { $in: ['starting', 'running'] }
		},
		{
			$set: {
				status: 'completed', activeTracks: 0, heartbeatAt: now, updatedAt: now,
				errorCode: 'WORKER_LEASE_RELEASED', errorMessage: 'Live captions assistant stopped; lease released for re-takeover'
			},
			$unset: { workerId: 1 }
		}
	).exec();
	if (result.modifiedCount) {
		logger.info(`Released ${result.modifiedCount} active ASR lease(s) for room '${roomId}'`);
	}
}
