// src/ai/flows/generate-agent-response.ts
'use server';

import { ai } from '@/ai/ai-instance'; //
import { z } from 'genkit';

// Define the input schema for the flow
const GenerateAgentResponseInputSchema = z.object({
  topic: z.string().describe('The main topic of the discussion.'),
  role: z.string().describe("The role assigned to this agent."),
  history: z.array(z.object({ // Representing conversation history
    role: z.string(),
    response: z.string(),
  })).describe('The conversation history up to this point.'),
});
export type GenerateAgentResponseInput = z.infer<typeof GenerateAgentResponseInputSchema>;

// Define the output schema for the flow
const GenerateAgentResponseOutputSchema = z.object({
  response: z.string().describe("The agent's response."),
});
export type GenerateAgentResponseOutput = z.infer<typeof GenerateAgentResponseOutputSchema>;

// Define the prompt for the LLM
const prompt = ai.definePrompt({
  name: 'generateAgentResponsePrompt',
  input: { schema: GenerateAgentResponseInputSchema },
  output: { schema: GenerateAgentResponseOutputSchema },
  prompt: `You are an AI agent participating in a board meeting discussion.
  Your assigned role is: {{{role}}}.
  The main topic of the discussion is: {{{topic}}}.

  Here is the conversation history so far:
  {{#each history}}
  - {{this.role}}: {{this.response}}
  {{/each}}

  Your task:
  - Focus on the most critical, controversial, or challenging points related to the topic.
  - Avoid superficial or repetitive comments.
  - If you have nothing substantial to add this turn, reply with exactly: SKIP
  - If you are the Moderator and you believe the discussion has reached a natural conclusion, reply with exactly: CONCLUDE

  Based on your role, the topic, and the history, provide your next contribution to the discussion. Keep your response relevant and impactful.`,
});

// Define the Genkit flow
export const generateAgentResponseFlow = ai.defineFlow<
  typeof GenerateAgentResponseInputSchema,
  typeof GenerateAgentResponseOutputSchema
>(
  {
    name: 'generateAgentResponseFlow',
    inputSchema: GenerateAgentResponseInputSchema,
    outputSchema: GenerateAgentResponseOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    // Fallback in case the model doesn't return structured output
    const response = output?.response ?? 'No response generated.';
    return { response };
  }
);

// Optional: Export a function for easier calling from your app
export async function generateAgentResponse(input: GenerateAgentResponseInput): Promise<GenerateAgentResponseOutput> {
   return generateAgentResponseFlow(input);
}