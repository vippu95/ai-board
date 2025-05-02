'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Bot, Sparkles, Edit } from 'lucide-react';
import { determineAgentRoles, DetermineAgentRolesInput, DetermineAgentRolesOutput } from '@/ai/flows/determine-agent-roles';
import { generateAgentResponse } from '@/ai/flows/generate-agent-response';
import { summarizeMeetingConclusion, SummarizeMeetingConclusionInput, SummarizeMeetingConclusionOutput } from '@/ai/flows/summarize-meeting-conclusion';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/hooks/use-toast'; // Import useToast

type Agent = {
  id: string;
  role: string;
  icon?: React.ComponentType<{ className?: string }>;
};

type DiscussionMessage = {
  agentRole: string;
  message: string;
  timestamp: Date;
};

type AppState = 'idle' | 'planning' | 'discussing' | 'concluding' | 'finished';

// Basic mapping, could be expanded
const roleIcons: { [key: string]: React.ComponentType<{ className?: string }> } = {
  default: Bot, // Default icon
  moderator: Sparkles,
  user: User,
  analyst: Bot,
  strategist: Bot,
  critic: Bot,
  ethicist: Bot,
};


export default function Home() {
  const [topic, setTopic] = useState<string>('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [discussion, setDiscussion] = useState<DiscussionMessage[]>([]);
  const [conclusion, setConclusion] = useState<string>('');
  const [appState, setAppState] = useState<AppState>('idle');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [editingRoles, setEditingRoles] = useState<boolean>(false);
  const [editedRoles, setEditedRoles] = useState<string[]>([]);
  const { toast } = useToast(); // Initialize useToast

  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Scroll to bottom when discussion updates or conclusion is added
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        // Use setTimeout to allow the DOM to update before scrolling
        setTimeout(() => {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        }, 0);
      }
    }
  }, [discussion, conclusion, appState]); // Add conclusion and appState dependencies


  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || isLoading) return;

    setIsLoading(true);
    setAppState('planning');
    setDiscussion([]); // Clear previous discussion
    setConclusion(''); // Clear previous conclusion
    setAgents([]); // Clear previous agents
    setEditingRoles(false); // Reset editing state

    try {
      const input: DetermineAgentRolesInput = { topic };
      const roles: DetermineAgentRolesOutput = await determineAgentRoles(input);

      if (!roles || roles.length === 0) {
        toast({
          title: "Role Generation Failed",
          description: "Could not determine agent roles. Please try a different topic.",
          variant: "destructive",
        });
        setAppState('idle');
        return;
      }

      const initialAgents = roles.map((role, index) => ({
        id: `agent-${index}`,
        role: role,
        icon: roleIcons[role.toLowerCase()] || roleIcons.default,
      }));
      setAgents(initialAgents);
      setEditedRoles(roles); // Initialize edited roles
    } catch (error) {
      console.error("Error determining agent roles:", error);
      toast({
        title: "Error",
        description: "Failed to determine agent roles. Please try again.",
        variant: "destructive",
      });
      setAppState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = (index: number, newRole: string) => {
    const updatedRoles = [...editedRoles];
    updatedRoles[index] = newRole;
    setEditedRoles(updatedRoles);
  };

  const saveEditedRoles = () => {
    const updatedAgents = editedRoles.map((role, index) => ({
      id: `agent-${index}`,
      role: role,
      icon: roleIcons[role.toLowerCase()] || roleIcons.default,
    }));
    setAgents(updatedAgents);
    setEditingRoles(false);
    toast({
      title: "Roles Updated",
      description: "Agent roles have been saved.",
    })
  }

  const startDiscussion = async () => {
    if (isLoading || agents.length === 0) return;

    setIsLoading(true);
    setAppState('discussing');
    setDiscussion([]); // Start fresh discussion
    setConclusion(''); // Clear conclusion

    let currentDiscussion: DiscussionMessage[] = [];
    let continueDiscussion = true;
    const maxTurns = 14; // Limit discussion length for now

    // Initial Moderator message
    const moderatorMessage: DiscussionMessage = {
      agentRole: 'Moderator',
      message: `Let's begin the discussion on "${topic}". We have the following roles participating: ${agents.map(a => a.role).join(', ')}. I'll now ask each role for their initial thoughts.`,
      timestamp: new Date(),
    };
    currentDiscussion.push(moderatorMessage);
    setDiscussion([...currentDiscussion]);


    while (continueDiscussion && currentDiscussion.length < maxTurns + 1) { // +1 for moderator start
      try {
        const agentRoles = ["Moderator"].concat(agents.map(a => a.role));
        console.log("Agent roles: ", agentRoles);
        console.log("Agent roles length: ", agentRoles.length);
        const lastRole = currentDiscussion[currentDiscussion.length - 1].agentRole;
        const lastRoleIdx = agentRoles.indexOf(lastRole);
        console.log("Last roles: ", lastRole);
        console.log("Last roles idx: ", lastRoleIdx);
        const nextRoleIdx = (lastRoleIdx + 1) % agentRoles.length;
        const nextRole = agentRoles[nextRoleIdx];

        console.log("Next role idx: ", nextRoleIdx);
        console.log("Next role: ", nextRole);
        const nextMessage = await generateAgentResponse({
          topic,
          role: nextRole,
          history: currentDiscussion.map(msg => ({
            role: msg.agentRole,
            response: msg.message,
          }))
        });

        console.log("Next message is: %s", nextMessage.response);
        // Handle agent skipping turn
        if (nextMessage.response.trim() === 'SKIP') {
          continue;
        }

        // If moderator says CONCLUDE, end discussion
        if ((nextRole.toLowerCase() === 'moderator' && nextMessage.response.trim() === 'CONCLUDE') || (currentDiscussion.length >= maxTurns + 1)) {
          const concludingModeratorMessage: DiscussionMessage = {
            agentRole: 'Moderator',
            message: "Thank you all for your contributions. I will now summarize the key points and conclusion.",
            timestamp: new Date(),
          };
          currentDiscussion.push(concludingModeratorMessage);
          setDiscussion([...currentDiscussion]);
          break;
        }

        // Moderator will only check if the discussion can be concluded. It won't participate in the discussion
        if(nextRole.toLowerCase() === 'moderator') {
            const nextDiscussion: DiscussionMessage = {
              agentRole: nextRole,
              message: nextMessage.response,
              timestamp: new Date(),
            };
            currentDiscussion.push(nextDiscussion)
            setDiscussion([...currentDiscussion]);
        }
      } catch (error) {
        console.error("Error during discussion step:", error);
        toast({
          title: "Discussion Error",
          description: "An error occurred during the discussion.",
          variant: "destructive",
        });
        continueDiscussion = false; // Stop on error
      }
    }

    setAppState('concluding');
    // No longer set loading false here, it will be set in generateConclusion
    await generateConclusion(currentDiscussion);
  };

  const generateConclusion = async (finalDiscussion: DiscussionMessage[]) => {
    // setIsLoading is already true from startDiscussion or if called separately
    setIsLoading(true); // Ensure loading is true
    try {
      const transcript = finalDiscussion.map(msg => `${msg.agentRole}: ${msg.message}`).join('\n\n');
      const input: SummarizeMeetingConclusionInput = { transcript };
      const result: SummarizeMeetingConclusionOutput = await summarizeMeetingConclusion(input);
      setConclusion(result.conclusion);
      setAppState('finished'); // Move state change here
    } catch (error) {
      console.error("Error generating conclusion:", error);
      setConclusion("Error generating conclusion.");
      toast({
        title: "Conclusion Error",
        description: "Failed to generate the meeting conclusion.",
        variant: "destructive",
      });
      setAppState('finished'); // Also set finished on error
    } finally {
      setIsLoading(false);
    }
  }

  const getAgentIcon = (role: string) => {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === 'moderator') return Sparkles;
    const agent = agents.find(a => a.role.toLowerCase() === normalizedRole);
    return agent?.icon || roleIcons.default;
  }

  const resetApp = () => {
    setAppState('idle');
    setTopic('');
    setAgents([]);
    setDiscussion([]);
    setConclusion('');
    setEditingRoles(false);
    setEditedRoles([]);
    setIsLoading(false); // Ensure loading is reset
  }

  return (
    <div className="container mx-auto p-4 flex flex-col h-screen max-h-screen">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-primary">AI Boardroom</h1>
        <p className="text-muted-foreground">Enter a topic and watch AI agents discuss it.</p>
      </header>

      <div className="flex flex-1 gap-4 overflow-hidden">

        {/* Left Panel: Setup */}
        <div className="w-1/3 flex flex-col gap-4 overflow-hidden"> {/* Added overflow-hidden */}
          <Card className="flex-shrink-0">
            <CardHeader>
              <CardTitle>1. Start Discussion</CardTitle>
              <CardDescription>Enter the topic you want the AI agents to discuss.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTopicSubmit}>
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="topic">Topic</Label>
                  <Input
                    id="topic"
                    placeholder="e.g., The future of renewable energy"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={isLoading || appState !== 'idle'}
                  />
                </div>
              </form>
            </CardContent>
            <CardFooter>
              {appState === 'idle' || appState === 'finished' ? (
                <Button onClick={appState === 'finished' ? resetApp : handleTopicSubmit} disabled={!topic && appState === 'idle'} className="w-full">
                  {appState === 'finished' ? 'Start New Topic' : 'Define Agent Roles'}
                </Button>
              ) : (
                <Button disabled={true} className="w-full">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Roles...
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Discussion Plan Card - Shown only during 'planning' state and onwards until reset */}
          {(appState === 'planning' || appState === 'discussing' || appState === 'concluding' || appState === 'finished') && agents.length > 0 && (
            <Card className="flex-shrink-0 flex flex-col overflow-hidden"> {/* Added flex flex-col overflow-hidden */}
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>2. Discussion Plan</CardTitle>
                  {!editingRoles && appState === 'planning' && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingRoles(true)} disabled={isLoading}>
                      <Edit className="mr-2 h-4 w-4" /> Edit Roles
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {appState === 'planning' ? 'The moderator proposed these roles. You can edit them before starting.' : 'The participating agent roles.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0"> {/* Added flex-1 overflow-hidden p-0 */}
                <ScrollArea className="h-full max-h-[250px] p-6"> {/* Added ScrollArea with max-height */}
                  <div className="space-y-2"> {/* Added wrapper div */}
                    {editingRoles ? (
                      editedRoles.map((role, index) => (
                        <div key={`edit-${index}`} className="flex items-center gap-2">
                          <Input
                            value={role}
                            onChange={(e) => handleRoleChange(index, e.target.value)}
                            className="flex-grow"
                            disabled={isLoading || appState !== 'planning'}
                          />
                          {/* Potential: Add remove button */}
                        </div>
                      ))
                    ) : (
                      agents.map((agent) => {
                        const Icon = agent.icon || roleIcons.default;
                        return (
                          <div key={agent.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary">
                            <Icon className="h-5 w-5 text-primary" />
                            <span className="font-medium">{agent.role}</span>
                          </div>
                        );
                      })
                    )}
                    {editingRoles && (
                      <div className="flex justify-end gap-2 pt-2">
                        {/* Potential: Add "Add Role" button */}
                        <Button variant="outline" onClick={() => { setEditingRoles(false); setEditedRoles(agents.map(a => a.role)); }} disabled={isLoading}>Cancel</Button>
                        <Button onClick={saveEditedRoles} disabled={isLoading}>Save Roles</Button>
                      </div>
                    )}
                  </div> {/* Close wrapper div */}
                </ScrollArea> {/* Close ScrollArea */}
              </CardContent>
              {/* Show Start/Running/Finished Button */}
              {appState === 'planning' && !editingRoles && (
                <CardFooter>
                  <Button onClick={startDiscussion} disabled={isLoading || agents.length === 0} className="w-full">
                    Start Board Meeting
                  </Button>
                </CardFooter>
              )}
              {(appState === 'discussing' || appState === 'concluding') && (
                <CardFooter>
                  <Button disabled={true} className="w-full">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {appState === 'discussing' ? 'Discussion in Progress...' : 'Generating Conclusion...'}
                  </Button>
                </CardFooter>
              )}
              {appState === 'finished' && (
                <CardFooter>
                  <Button variant="outline" onClick={resetApp} className="w-full">
                    Start New Topic
                  </Button>
                </CardFooter>
              )}
            </Card>
          )}

          {/* Removed the separate Conclusion Card */}

        </div>

        {/* Right Panel: Discussion & Conclusion */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Live Discussion & Conclusion</CardTitle>
            <CardDescription>
              {appState === 'idle' && 'Start a topic to see the discussion.'}
              {appState === 'planning' && 'Review roles and start the meeting.'}
              {(appState === 'discussing' || appState === 'concluding') && 'Watch the AI agents discuss the topic in real-time.'}
              {appState === 'finished' && 'The meeting discussion and conclusion.'}
            </CardDescription>
          </CardHeader>
          {/* The ref is now correctly on the CardContent which contains the ScrollArea */}
          <CardContent ref={scrollAreaRef} className="flex-1 overflow-hidden p-0">
            {/* ScrollArea now correctly takes the full height of its parent (CardContent) */}
            <ScrollArea className="h-full p-6">
              {discussion.length === 0 && !conclusion && appState !== 'discussing' && appState !== 'concluding' && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Bot size={48} className="mb-4" />
                  {appState === 'idle' && <p>Enter a topic and click "Define Agent Roles" to begin.</p>}
                  {appState === 'planning' && <p>Review the agent roles and click "Start Board Meeting".</p>}
                  {appState !== 'idle' && appState !== 'planning' && <p>The discussion will appear here once started.</p>}
                </div>
              )}
              <div className="space-y-4">
                {discussion.map((msg, index) => {
                  const Icon = getAgentIcon(msg.agentRole);
                  const isUserOrModerator = msg.agentRole === 'User' || msg.agentRole === 'Moderator';
                  const bgColor = msg.agentRole === 'Moderator' ? 'bg-primary/10' : 'bg-secondary';
                  const borderColor = msg.agentRole === 'Moderator' ? 'border-primary/30' : 'border-border';
                  const textColor = msg.agentRole === 'Moderator' ? 'text-primary' : 'text-foreground';
                  // Highlight only the very last message during discussion phase
                  const isHighlighted = appState === 'discussing' && index === discussion.length - 1;

                  return (
                    <div
                      key={`msg-${index}`}
                      className={`flex gap-3 p-3 rounded-lg border ${bgColor} ${borderColor} ${isHighlighted ? 'ring-2 ring-accent' : ''}`}
                    >
                      <Icon className={`h-6 w-6 mt-1 flex-shrink-0 ${textColor}`} />
                      <div className="flex-1">
                        <p className={`font-semibold ${textColor}`}>{msg.agentRole}</p>
                        <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert text-foreground">
                          {msg.message}
                        </ReactMarkdown>
                        <p className="text-xs text-muted-foreground mt-1">
                          {msg.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Loading indicator during discussion or conclusion generation */}
                {isLoading && (appState === 'discussing' || appState === 'concluding') && (
                  <div className="flex items-center text-muted-foreground justify-center p-4">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>{appState === 'discussing' ? 'Agent thinking...' : 'Generating conclusion...'}</span>
                  </div>
                )}

                {/* Display Conclusion */}
                {appState === 'finished' && conclusion && (
                  <div className="mt-6 pt-4 border-t border-dashed">
                    <h3 className="text-lg font-semibold mb-2 text-primary flex items-center gap-2">
                      <Sparkles className="h-5 w-5" /> Meeting Conclusion
                    </h3>
                    <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert bg-card p-4 rounded-md border">
                      {conclusion}
                    </ReactMarkdown>
                  </div>
                )}
                {appState === 'finished' && !conclusion && (
                  <div className="mt-6 pt-4 border-t border-dashed text-center text-destructive">
                    Failed to generate conclusion.
                  </div>
                )}
              </div>

            </ScrollArea>
          </CardContent>
          {/* Footer with reset button only needed if discussion panel is the only place to restart */}
          {/*
            {appState === 'finished' && (
                <CardFooter className="border-t pt-4">
                     <Button variant="outline" onClick={resetApp} className="w-full">
                         Start New Topic
                     </Button>
                </CardFooter>
            )}
           */}
        </Card>

      </div>
    </div>
  );
}

