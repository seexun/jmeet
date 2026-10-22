import { MeetAssistantCapabilityName } from '@openvidu-meet/typings';
import { z } from 'zod';

export const CreateAssistantReqSchema = z.object({
	// scope: z.object({
	// 	resourceType: z.nativeEnum(MeetAssistantScopeResourceType),
	// 	resourceIds: z.array(z.string().trim().min(1)).min(1)
	// }),
	capabilities: z
		.array(
			z.object({
				name: z.string()
			})
		)
		.min(1)
		.transform((capabilities) => {
			const validValues = Object.values(MeetAssistantCapabilityName);

			// Filter out invalid capabilities
			const filtered = capabilities.filter((cap) =>
				validValues.includes(cap.name as MeetAssistantCapabilityName)
			);

			// Remove duplicates based on capability name
			const unique = Array.from(new Map(filtered.map((cap) => [cap.name, cap])).values());

			return unique;
		})
		.refine((caps) => caps.length > 0, {
			message: 'At least one valid capability is required'
		})
});

export const AssistantIdSchema = z.string().trim().min(1);
