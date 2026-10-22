import { injectable } from 'inversify';
import winston from 'winston';
import { MEET_ENV } from '../environment.js';

@injectable()
export class LoggerService {
	public readonly logger: winston.Logger;

	constructor() {
		this.logger = winston.createLogger({
			level: MEET_ENV.LOG_LEVEL,
			format: winston.format.combine(
				winston.format.timestamp({
					format: 'YYYY-MM-DD HH:mm:ss'
				}),
				winston.format.printf((info) => {
					const meta =
						typeof info.metadata === 'object' && info.metadata !== null
							? Object.keys(info.metadata).length
								? JSON.stringify(info.metadata)
								: ''
							: '';
					return `${info.timestamp} | ${MEET_ENV.EDITION} | [${info.level}] ${info.message} ${meta}`;

					// return `${info.timestamp} [${info.level}] ${info.message}`;
				}),
				winston.format.errors({ stack: true })
			),
			transports: [
				new winston.transports.Console({
					format: winston.format.combine(
						winston.format.colorize(),
						winston.format.timestamp({
							format: 'YYYY-MM-DD HH:mm:ss'
						}),
						winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
						winston.format.printf((info) => {
							const meta =
								typeof info.metadata === 'object' && info.metadata !== null
									? Object.keys(info.metadata).length
										? JSON.stringify(info.metadata)
										: ''
									: '';
							return `${info.timestamp} | ${MEET_ENV.EDITION} | [${info.level}] ${info.message} ${meta}`;

							// return `${info.timestamp} [${info.level}] ${info.message}`;
						})
					)
				})
			]
		});
	}

	// Generic method to log messages with a specific level
	protected log(level: string, message: string, ...meta: unknown[]): void {
		this.logger.log(level, message, ...meta);
	}

	// Logs a message as an error
	public error(message: string, ...meta: unknown[]): void {
		this.log('error', message, ...meta);
	}

	// Logs a message as a warning
	public warn(message: string, ...meta: unknown[]): void {
		this.log('warn', message, ...meta);
	}

	// Logs a message as general information
	public info(message: string, ...meta: unknown[]): void {
		this.log('info', message, ...meta);
	}

	// Logs a message as verbose
	public verbose(message: string, ...meta: unknown[]): void {
		this.log('verbose', message, ...meta);
	}

	// Logs a message for debugging purposes
	public debug(message: string, ...meta: unknown[]): void {
		this.log('debug', message, ...meta);
	}

	// Logs a message as trivial information
	public silly(message: string, ...meta: unknown[]): void {
		this.log('silly', message, ...meta);
	}
}
