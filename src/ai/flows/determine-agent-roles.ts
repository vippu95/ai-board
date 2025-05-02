'use server';

/**
 * @fileOverview This file defines the Genkit flow for determining agent roles based on a given topic.
 *
 * - determineAgentRoles - A function that takes a topic as input and returns a list of agent roles.
 * - DetermineAgentRolesInput - The input type for the determineAgentRoles function.
 * - DetermineAgentRolesOutput - The return type for the determineAgentRoles function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const DetermineAgentRolesInputSchema = z.object({
  topic: z.string().describe('The topic to be discussed by the AI agents.'),
});
export type DetermineAgentRolesInput = z.infer<typeof DetermineAgentRolesInputSchema>;

const DetermineAgentRolesOutputSchema = z.array(z.string().describe('The roles of the AI agents.'));
export type DetermineAgentRolesOutput = z.infer<typeof DetermineAgentRolesOutputSchema>;

export async function determineAgentRoles(input: DetermineAgentRolesInput): Promise<DetermineAgentRolesOutput> {
  return determineAgentRolesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'determineAgentRolesPrompt',
  input: {
    schema: z.object({
      topic: z.string().describe('The topic to be discussed by the AI agents.'),
    }),
  },
  output: {
    schema: z.array(z.string().describe('The roles of the AI agents.')),
  },
  prompt: `You are a moderator for a board meeting. Your task is to determine the roles of AI agents required for an effective discussion on the following topic: {{{topic}}}. Please provide a list of roles that would contribute to a balanced and thorough discussion. The roles should be distinct and cover different aspects of the topic. Return the list of roles.`,
});

const determineAgentRolesFlow = ai.defineFlow<
  typeof DetermineAgentRolesInputSchema,
  typeof DetermineAgentRolesOutputSchema
>(
  {
    name: 'determineAgentRolesFlow',
    inputSchema: DetermineAgentRolesInputSchema,
    outputSchema: DetermineAgentRolesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
