import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, Trash2, Power, PowerOff, Plus, Bot, Info } from "lucide-react";
import api from "@/lib/api";
import type { List, Label as BoardLabel, AutomationRule } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AutomationModalProps {
  boardId: string;
  lists: List[];
  labels: BoardLabel[];
  isOpen: boolean;
  onClose: () => void;
}

export function AutomationModal({
  boardId,
  lists,
  labels,
  isOpen,
  onClose,
}: AutomationModalProps) {
  const queryClient = useQueryClient();
  const [ruleName, setRuleName] = useState("");
  const [triggerType, setTriggerType] = useState("checklist_complete");
  const [triggerListId, setTriggerListId] = useState("");
  const [actionType, setActionType] = useState("move_card_to_list");
  const [actionListId, setActionListId] = useState("");
  const [actionLabelId, setActionLabelId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Set defaults when lists/labels are loaded
  if (lists.length > 0 && !triggerListId) {
    setTriggerListId(lists[0].id);
  }
  if (lists.length > 0 && !actionListId) {
    setActionListId(lists[0].id);
  }
  if (labels.length > 0 && !actionLabelId) {
    setActionLabelId(labels[0].id);
  }

  // Fetch all automation rules
  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ["board-rules", boardId],
    queryFn: () => api.get(`/api/boards/${boardId}/rules`).then((r) => r.data),
    enabled: isOpen,
  });

  // Create rule
  const createRule = useMutation({
    mutationFn: (data: {
      name: string;
      trigger: string;
      trigger_params: string;
      action: string;
      action_params: string;
    }) => api.post(`/api/boards/${boardId}/rules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-rules", boardId] });
      setRuleName("");
      setIsCreating(false);
      toast.success("Automation rule created!");
    },
    onError: () => {
      toast.error("Failed to create rule");
    },
  });

  // Toggle rule
  const toggleRule = useMutation({
    mutationFn: (data: { id: string; is_active: boolean }) =>
      api.put(`/api/rules/${data.id}/toggle`, { is_active: data.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-rules", boardId] });
      toast.success("Rule updated");
    },
  });

  // Delete rule
  const deleteRule = useMutation({
    mutationFn: (id: string) => api.delete(`/api/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board-rules", boardId] });
      toast.success("Rule deleted");
    },
  });

  const handleCreate = () => {
    if (!ruleName.trim()) {
      toast.error("Rule name is required");
      return;
    }

    // Build params
    const triggerParams: Record<string, string> = {};
    if (triggerType === "card_moved_to_list" || triggerType === "card_created_in_list") {
      triggerParams.list_id = triggerListId;
    }

    const actionParams: Record<string, string> = {};
    if (actionType === "move_card_to_list") {
      actionParams.list_id = actionListId;
    } else if (actionType === "add_label") {
      actionParams.label_id = actionLabelId;
    }

    createRule.mutate({
      name: ruleName,
      trigger: triggerType,
      trigger_params: JSON.stringify(triggerParams),
      action: actionType,
      action_params: JSON.stringify(actionParams),
    });
  };

  const getListName = (id: string) => {
    return lists.find((l) => l.id === id)?.name || "Unknown List";
  };

  const getLabelName = (id: string) => {
    const l = labels.find((lbl) => lbl.id === id);
    return l ? `${l.name} (${l.color})` : "Unknown Label";
  };

  const renderTriggerDesc = (trigger: string, paramsStr: string) => {
    try {
      const p = JSON.parse(paramsStr);
      switch (trigger) {
        case "checklist_complete":
          return "When checklist is 100% completed";
        case "card_moved_to_list":
          return `When card is moved to list "${getListName(p.list_id)}"`;
        case "card_created_in_list":
          return `When card is created in list "${getListName(p.list_id)}"`;
        default:
          return trigger;
      }
    } catch {
      return trigger;
    }
  };

  const renderActionDesc = (action: string, paramsStr: string) => {
    try {
      const p = JSON.parse(paramsStr);
      switch (action) {
        case "move_card_to_list":
          return `move card to list "${getListName(p.list_id)}"`;
        case "add_label":
          return `add label "${getLabelName(p.label_id)}" to card`;
        case "archive_card":
          return "archive the card";
        case "complete_all_items":
          return "complete all checklist items";
        default:
          return action;
      }
    } catch {
      return action;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-3xl sm:max-w-3xl bg-popover border max-h-[85vh] overflow-y-auto p-6">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Bot className="w-5 h-5 text-primary" />
            Butler Automation
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Set up automatic rules triggered by actions on your board to boost productivity.
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Create Rule Toggle Button */}
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">
              {isCreating ? "New Automation Rule" : "Active Rules"}
            </h3>
            <Button
              size="sm"
              variant={isCreating ? "ghost" : "default"}
              onClick={() => setIsCreating(!isCreating)}
              className="cursor-pointer gap-1.5"
            >
              {isCreating ? (
                "Back to rules"
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Create Rule
                </>
              )}
            </Button>
          </div>

          {isCreating ? (
            /* Creation Form */
            <div className="space-y-4 bg-muted/40 p-4 rounded-xl border">
              <div>
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input
                  id="rule-name"
                  placeholder="e.g. Move complete cards to Done"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Trigger */}
              <div className="space-y-2">
                <Label>1. Select Trigger</Label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full bg-card border rounded-md p-2 text-sm text-foreground focus:outline-none"
                >
                  <option value="checklist_complete">When checklist is 100% completed</option>
                  <option value="card_moved_to_list">When card is moved to list...</option>
                  <option value="card_created_in_list">When card is created in list...</option>
                </select>

                {(triggerType === "card_moved_to_list" || triggerType === "card_created_in_list") && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Select Trigger List</Label>
                    <select
                      value={triggerListId}
                      onChange={(e) => setTriggerListId(e.target.value)}
                      className="w-full bg-card border rounded-md p-2 text-sm text-foreground mt-1 focus:outline-none"
                    >
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="space-y-2">
                <Label>2. Select Action</Label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full bg-card border rounded-md p-2 text-sm text-foreground focus:outline-none"
                >
                  <option value="move_card_to_list">Move card to list...</option>
                  <option value="add_label">Add label to card...</option>
                  <option value="archive_card">Archive card</option>
                  <option value="complete_all_items">Complete all checklist items</option>
                </select>

                {actionType === "move_card_to_list" && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Select Destination List</Label>
                    <select
                      value={actionListId}
                      onChange={(e) => setActionListId(e.target.value)}
                      className="w-full bg-card border rounded-md p-2 text-sm text-foreground mt-1 focus:outline-none"
                    >
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {actionType === "add_label" && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Select Label to Add</Label>
                    <select
                      value={actionLabelId}
                      onChange={(e) => setActionLabelId(e.target.value)}
                      className="w-full bg-card border rounded-md p-2 text-sm text-foreground mt-1 focus:outline-none"
                    >
                      {labels.map((lbl) => (
                        <option key={lbl.id} value={lbl.id}>
                          {lbl.name} ({lbl.color})
                        </option>
                      ))}
                      {labels.length === 0 && (
                        <option disabled>No labels created on this board yet</option>
                      )}
                    </select>
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreate}
                disabled={createRule.isPending}
                className="w-full cursor-pointer mt-2"
              >
                {createRule.isPending ? "Creating rule..." : "Save Automation"}
              </Button>
            </div>
          ) : (
            /* Rules List */
            <div className="space-y-3">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-6">Loading rules...</p>
              ) : rules.length > 0 ? (
                rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-start justify-between p-4 bg-muted/30 border rounded-lg hover:border-border/80 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{rule.name}</span>
                        {!rule.is_active && (
                          <span className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground uppercase font-semibold">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Trigger: </span>
                        {renderTriggerDesc(rule.trigger, rule.trigger_params)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Action: </span>
                        {renderActionDesc(rule.action, rule.action_params)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          toggleRule.mutate({ id: rule.id, is_active: !rule.is_active })
                        }
                        title={rule.is_active ? "Deactivate rule" : "Activate rule"}
                        className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        {rule.is_active ? (
                          <Power className="w-4 h-4 text-green-500" />
                        ) : (
                          <PowerOff className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRule.mutate(rule.id)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 cursor-pointer"
                        title="Delete rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 border border-dashed rounded-lg bg-muted/10 space-y-2">
                  <Bot className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                  <p className="text-sm text-muted-foreground">No automation rules configured yet.</p>
                  <p className="text-xs text-muted-foreground/60">
                    Click "Create Rule" above to add your first Butler rule.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
