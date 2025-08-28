import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, X } from "lucide-react";
import type { ChatMessage } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Chatbot({ isOpen, onClose }: ChatbotProps) {
  const [inputMessage, setInputMessage] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { data: messages, refetch } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
    enabled: isOpen && !!user,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      await apiRequest("POST", "/api/chat/messages", {
        message,
        isFromUser: true,
      });
    },
    onSuccess: () => {
      refetch();
      setInputMessage("");
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    sendMessageMutation.mutate(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-80 z-50" data-testid="chatbot-container">
      <Card className="shadow-xl border border-border">
        <CardHeader className="bg-primary rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-primary-foreground">
              <Bot size={20} />
              <span>AI Assistant</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary/20"
              data-testid="button-close-chatbot"
            >
              <X size={16} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-64 p-4" ref={scrollAreaRef}>
            <div className="space-y-3">
              {!messages || messages.length === 0 ? (
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Bot className="text-primary-foreground" size={12} />
                  </div>
                  <div className="bg-muted rounded-lg p-3 max-w-xs">
                    <p className="text-sm text-foreground">
                      Hello! I'm your inventory assistant. How can I help you today?
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start space-x-2 ${
                      message.isFromUser ? "flex-row-reverse space-x-reverse" : ""
                    }`}
                    data-testid={`chat-message-${message.id}`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        message.isFromUser
                          ? "bg-chart-1"
                          : "bg-primary"
                      }`}
                    >
                      {message.isFromUser ? (
                        <User className="text-white" size={12} />
                      ) : (
                        <Bot className="text-primary-foreground" size={12} />
                      )}
                    </div>
                    <div
                      className={`rounded-lg p-3 max-w-xs ${
                        message.isFromUser
                          ? "bg-chart-1 text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-sm" data-testid={`chat-message-text-${message.id}`}>
                        {message.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-border">
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="Ask about inventory..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={sendMessageMutation.isPending}
                className="flex-1 text-sm"
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={sendMessageMutation.isPending || !inputMessage.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                size="sm"
                data-testid="button-send-message"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
