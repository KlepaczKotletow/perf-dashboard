"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface PerformanceTabsClientProps {
  resultsContent: React.ReactNode;
  todoContent: React.ReactNode;
  todoCount: number; // badge count for pending To Do items
}

export function PerformanceTabsClient({
  resultsContent,
  todoContent,
  todoCount,
}: PerformanceTabsClientProps) {
  return (
    <Tabs defaultValue="todo" className="space-y-6">
      <TabsList className="h-9">
        <TabsTrigger value="todo" className="text-sm gap-2">
          To Do
          {todoCount > 0 && (
            <Badge className="text-[10px] h-4 px-1.5 bg-primary text-primary-foreground font-medium">
              {todoCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="results" className="text-sm">
          Results
        </TabsTrigger>
      </TabsList>
      <TabsContent value="todo" className="mt-0">
        {todoContent}
      </TabsContent>
      <TabsContent value="results" className="mt-0">
        {resultsContent}
      </TabsContent>
    </Tabs>
  );
}
