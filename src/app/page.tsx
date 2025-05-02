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

// Simulate a discussion step - replace with actual GenAI flow later
const simulateDiscussionStep = async (topic: string, roles: string[], history: DiscussionMessage[]): Promise<DiscussionMessage> => {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000)); // Simulate AI thinking time

  const lastSpeakerIndex = roles.indexOf(history[history.length - 1]?.agentRole ?? '');
  const nextSpeakerIndex = (lastSpeakerIndex + 1) % roles.length;
  const nextSpeakerRole = roles[nextSpeakerIndex];

  // Simple simulated response based on role and topic
  let message = `As the ${nextSpeakerRole}, regarding "${topic}", I believe... `;
  if (history.length < roles.length * 2) { // Let each agent speak twice initially
      message += `we should consider [simulated argument related to ${nextSpeakerRole}].`;
  } else {
      message += ` based on the previous points, my conclusion is [simulated final thought related to ${nextSpeakerRole}].`;
      // Potentially signal end of discussion
      if (Math.random() > 0.7 && history.length > roles.length * 3) {
          // Signal end, will be handled in main logic
      }
  }


  return {
    agentRole: nextSpeakerRole,
    message: message,
    timestamp: new Date(),
  };
};

// Basic mapping, could be expanded
const roleIcons: { [key: string]: React.ComponentType<{ className?: string }> } = {
    default: Bot, // Default icon
    moderator: Sparkles,
    user: User,
    // Add more specific role icons if needed
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
    // Scroll to bottom when discussion updates
    if (scrollAreaRef.current) {
      // The ShadCN ScrollArea component nests the scrollable viewport.
      // We need to query for the viewport element within the ref.
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [discussion]);


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

    let currentDiscussion: DiscussionMessage[] = [];
    let continueDiscussion = true;
    const maxTurns = agents.length * 4; // Limit discussion length for now

    // Initial Moderator message
    const moderatorMessage: DiscussionMessage = {
      agentRole: 'Moderator',
      message: `Let's begin the discussion on "${topic}". We have the following roles participating: ${agents.map(a => a.role).join(', ')}. I'll now ask each agent for their initial thoughts.`,
      timestamp: new Date(),
    };
    currentDiscussion.push(moderatorMessage);
    setDiscussion([...currentDiscussion]);


    while (continueDiscussion && currentDiscussion.length < maxTurns + 1) { // +1 for moderator start
      try {
        const agentRoles = agents.map(a => a.role);
        const nextMessage = await simulateDiscussionStep(topic, agentRoles, currentDiscussion);
        currentDiscussion.push(nextMessage);
        setDiscussion([...currentDiscussion]);

        // Simple condition to stop discussion (replace with GenAI decision later)
        if (currentDiscussion.length >= maxTurns + 1 || (Math.random() > 0.8 && currentDiscussion.length > agents.length * 2 + 1)) {
            continueDiscussion = false;
            // Add moderator concluding message
            const concludingModeratorMessage: DiscussionMessage = {
                agentRole: 'Moderator',
                message: "Thank you all for your contributions. I will now summarize the key points and conclusion.",
                timestamp: new Date(),
            };
            currentDiscussion.push(concludingModeratorMessage);
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
    await generateConclusion(currentDiscussion);
    setIsLoading(false);
  };

  const generateConclusion = async (finalDiscussion: DiscussionMessage[]) => {
     setIsLoading(true);
     try {
        const transcript = finalDiscussion.map(msg => `${msg.agentRole}: ${msg.message}`).join('\n\n');
        const input: SummarizeMeetingConclusionInput = { transcript };
        const result: SummarizeMeetingConclusionOutput = await summarizeMeetingConclusion(input);
        setConclusion(result.conclusion);
     } catch (error) {
        console.error("Error generating conclusion:", error);
        setConclusion("Error generating conclusion.");
        toast({
            title: "Conclusion Error",
            description: "Failed to generate the meeting conclusion.",
            variant: "destructive",
        });
     } finally {
        setIsLoading(false);
        setAppState('finished');
     }
  }

  const getAgentIcon = (role: string) => {
     const normalizedRole = role.toLowerCase();
     if (normalizedRole === 'moderator') return Sparkles;
     const agent = agents.find(a => a.role.toLowerCase() === normalizedRole);
     return agent?.icon || roleIcons.default;
  }

  return (
    <div className="container mx-auto p-4 flex flex-col h-screen max-h-screen">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-primary">AI Boardroom</h1>
        <p className="text-muted-foreground">Enter a topic and watch AI agents discuss it.</p>
      </header>

      <div className="flex flex-1 gap-4 overflow-hidden">

        {/* Left Panel: Setup & Conclusion */}
        <div className="w-1/3 flex flex-col gap-4 overflow-hidden"> {/* Added overflow-hidden */}
          <Card className="flex-shrink-0">
            <CardHeader>
              <CardTitle>1. Start a New Discussion</CardTitle>
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
                    disabled={isLoading && appState !== 'idle'}
                  />
                </div>
              </form>
            </CardContent>
            <CardFooter>
              <Button onClick={handleTopicSubmit} disabled={!topic || (isLoading && appState !== 'idle')} className="w-full">
                {isLoading && appState === 'planning' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {appState === 'idle' || appState === 'finished' ? 'Define Agent Roles' : 'Generating Roles...'}
              </Button>
            </CardFooter>
          </Card>

          {appState !== 'idle' && agents.length > 0 && (
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
                    <CardDescription>The moderator proposed these roles. You can edit them before starting.</CardDescription>
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
                                        disabled={isLoading}
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
                 {!editingRoles && appState === 'planning' && (
                    <CardFooter>
                        <Button onClick={startDiscussion} disabled={isLoading || agents.length === 0} className="w-full">
                            {isLoading && appState === 'discussing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Start Board Meeting
                        </Button>
                    </CardFooter>
                 )}
             </Card>
          )}

          {(appState === 'concluding' || appState === 'finished') && (
            <Card className="flex-1 flex flex-col overflow-hidden"> {/* Ensure conclusion card also handles overflow */}
              <CardHeader>
                <CardTitle>3. Meeting Conclusion</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-0"> {/* Use overflow-auto directly or wrap with ScrollArea */}
                <ScrollArea className="h-full p-6">
                    {isLoading && appState === 'concluding' ? (
                    <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="ml-2">Generating conclusion...</span>
                        </div>
                    ) : (
                        conclusion ? (
                            <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert">{conclusion}</ReactMarkdown>
                        ) : (
                            <p className="text-muted-foreground">The conclusion will appear here.</p>
                        )
                    )}
                </ScrollArea>
              </CardContent>
               {appState === 'finished' && (
                    <CardFooter>
                        <Button variant="outline" onClick={() => {
                            setAppState('idle');
                            setTopic('');
                            setAgents([]);
                            setDiscussion([]);
                            setConclusion('');
                        }} className="w-full">
                            Start New Topic
                        </Button>
                    </CardFooter>
                )}
            </Card>
          )}

        </div>

        {/* Right Panel: Discussion */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Live Discussion</CardTitle>
            <CardDescription>Watch the AI agents discuss the topic in real-time.</CardDescription>
          </CardHeader>
          {/* The ref is now correctly on the CardContent which contains the ScrollArea */}
          <CardContent ref={scrollAreaRef} className="flex-1 overflow-hidden p-0">
              {/* ScrollArea now correctly takes the full height of its parent (CardContent) */}
              <ScrollArea className="h-full p-6">
                {discussion.length === 0 && appState !== 'discussing' && appState !== 'concluding' && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                        <Bot size={48} className="mb-4"/>
                        <p>The discussion will appear here once started.</p>
                        {appState === 'planning' && <p className="mt-2 text-sm">Review the agent roles and click "Start Board Meeting".</p>}
                        {appState === 'idle' && <p className="mt-2 text-sm">Enter a topic and click "Define Agent Roles" to begin.</p>}
                    </div>
                )}
                <div className="space-y-4">
                    {discussion.map((msg, index) => {
                        const Icon = getAgentIcon(msg.agentRole);
                        const isUserOrModerator = msg.agentRole === 'User' || msg.agentRole === 'Moderator';
                        const bgColor = msg.agentRole === 'Moderator' ? 'bg-primary/10' : 'bg-secondary';
                        const borderColor = msg.agentRole === 'Moderator' ? 'border-primary/30' : 'border-border';
                        const textColor = msg.agentRole === 'Moderator' ? 'text-primary' : 'text-foreground';
                        const isHighlighted = appState === 'discussing' && index === discussion.length - 1;

                        return (
                            <div
                            key={index}
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
                    {isLoading && (appState === 'discussing' || appState === 'concluding') && (
                         <div className="flex items-center text-muted-foreground justify-center p-4">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            <span>{appState === 'discussing' ? 'Agent thinking...' : 'Generating conclusion...'}</span>
                        </div>
                    )}
                </div>

              </ScrollArea>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
