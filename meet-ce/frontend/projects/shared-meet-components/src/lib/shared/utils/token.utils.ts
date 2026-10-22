import { MeetRoomMemberTokenMetadata } from '@openvidu-meet/typings';
import { jwtDecode, JwtPayload } from 'jwt-decode';

interface LiveKitJwtClaims extends JwtPayload {
	metadata: string;
}

export interface DecodedRoomMemberToken extends Omit<LiveKitJwtClaims, 'metadata'> {
	metadata: MeetRoomMemberTokenMetadata;
}

export const decodeToken = (token: string): DecodedRoomMemberToken => {
	const decodedToken = jwtDecode<LiveKitJwtClaims>(token);

	return {
		...decodedToken,
		metadata: JSON.parse(decodedToken.metadata) as MeetRoomMemberTokenMetadata
	};
};
