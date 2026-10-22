import type { MeetUserOptions } from '@openvidu-meet/typings';
import { MEET_USER_SORT_FIELDS, MeetUserRole, SortOrder, TextMatchMode } from '@openvidu-meet/typings';
import { z } from 'zod';

export const UserOptionsSchema: z.ZodType<MeetUserOptions> = z.object({
	loginName: z
		.string()
		.min(3, 'loginName must be at least 3 characters long')
		.max(64, 'loginName cannot exceed 64 characters')
		.regex(/^[a-zA-Z0-9._-]+$/, 'loginName contains unsupported characters'),
	name: z.string().min(1, 'name is required and cannot be empty').max(50, 'name cannot exceed 50 characters'),
	email: z.string().email().optional(),
	employeeNumber: z.string().min(1).max(64).optional(),
	role: z.nativeEnum(MeetUserRole),
	password: z.string().min(5, 'password must be at least 5 characters long')
});

export const UserFiltersSchema = z
	.object({
		userId: z.string().optional(),
		name: z.string().optional(),
		nameMatchMode: z.nativeEnum(TextMatchMode).optional(),
		nameCaseInsensitive: z.preprocess((arg) => {
			if (typeof arg === 'string') {
				if (arg.toLowerCase() === 'true') return true;

				if (arg.toLowerCase() === 'false') return false;
			}

			return arg;
		}, z.boolean().optional().default(false)),
		role: z.nativeEnum(MeetUserRole).optional(),
		maxItems: z.coerce
			.number()
			.positive('maxItems must be a positive number')
			.transform((val) => {
				// Convert the value to a number
				const intVal = Math.floor(val);
				// Ensure it's not greater than 100
				return intVal > 100 ? 100 : intVal;
			})
			.default(10),
		nextPageToken: z.string().optional(),
		sortField: z.enum(MEET_USER_SORT_FIELDS).optional().default('registrationDate'),
		sortOrder: z.nativeEnum(SortOrder).optional().default(SortOrder.DESC)
	})
	.superRefine((data, ctx) => {
		if (data.nameMatchMode === TextMatchMode.REGEX && data.name) {
			try {
				new RegExp(String(data.name));
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['name'],
					message: 'Invalid regular expression pattern'
				});
			}
		}
	});

export const BulkDeleteUsersReqSchema = z.object({
	userIds: z.preprocess(
		(arg) => {
			if (typeof arg === 'string') {
				// If the argument is a string, it is expected to be a comma-separated list of user IDs.
				return arg
					.split(',')
					.map((s) => s.trim())
					.filter((s) => s !== '');
			}

			return [];
		},
		z.array(z.string()).min(1, {
			message: 'At least one userId is required'
		})
	)
});

export const ChangePasswordReqSchema = z.object({
	currentPassword: z.string(),
	newPassword: z.string().min(5, 'New password must be at least 5 characters long')
});

export const ResetUserPasswordReqSchema = z.object({
	newPassword: z.string().min(5, 'New password must be at least 5 characters long')
});

export const UpdateUserRoleReqSchema = z.object({
	role: z.nativeEnum(MeetUserRole)
});
