/*
 * Public API Surface of shared-meet-components
 */

// Export shared infrastructure first (no dependencies on domains)
export * from './lib/shared';

// Then export domains (which depend on shared)
export * from './lib/domains/auth';
export * from './lib/domains/console';
export * from './lib/domains/meeting';
export * from './lib/domains/room-members';
export * from './lib/domains/rooms';
export * from './lib/domains/users';
