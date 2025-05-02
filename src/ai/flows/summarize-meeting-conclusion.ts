// SummarizeMeetingConclusion flow
'use server';

/**
 * @fileOverview This file defines a Genkit flow for summarizing the conclusion of an AI board meeting.
 *
 * - summarizeMeetingConclusion - A function that takes the transcript of the meeting and returns a summarized conclusion.
 * - SummarizeMeetingConclusionInput - The input type for the summarizeMeetingConclusion function.
 * - SummarizeMeetingConclusionOutput - The return type for the summarizeMeetingConclusion function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SummarizeMeetingConclusionInputSchema = z.object({
  transcript: z
    .string()
    .describe('The transcript of the AI board meeting discussion.'),
});
export type SummarizeMeetingConclusionInput = z.infer<
  typeof SummarizeMeetingConclusionInputSchema
>;

const SummarizeMeetingConclusionOutputSchema = z.object({
  conclusion: z
    .string()
    .describe('A summarized conclusion of the AI board meeting.'),
});
export type SummarizeMeetingConclusionOutput = z.infer<
  typeof SummarizeMeetingConclusionOutputSchema
>;

export async function summarizeMeetingConclusion(
  input: SummarizeMeetingConclusionInput
): Promise<SummarizeMeetingConclusionOutput> {
  return summarizeMeetingConclusionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeMeetingConclusionPrompt',
  input: {
    schema: z.object({
      transcript: z
        .string()
        .describe('The transcript of the AI board meeting discussion.'),
    }),
  },
  output: {
    schema: z.object({
      conclusion: z
        .string()
        .describe('A summarized conclusion of the AI board meeting.'),
    }),
  },
  prompt: `You are an AI expert specializing in creating meeting summaries.\n\n  Given the following transcript of an AI board meeting, create a summarized conclusion of the meeting.\n  Transcript: {{{transcript}}}`,
});

const summarizeMeetingConclusionFlow = ai.defineFlow<
  typeof SummarizeMeetingConclusionInputSchema,
  typeof SummarizeMeetingConclusionOutputSchema
>(
  {
    name: 'summarizeMeetingConclusionFlow',
    inputSchema: SummarizeMeetingConclusionInputSchema,
    outputSchema: SummarizeMeetingConclusionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
