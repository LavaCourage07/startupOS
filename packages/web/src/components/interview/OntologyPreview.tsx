import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Edit, FileText, Folder, Box, GitBranch } from "lucide-react";
import type { OntologyModel, OntologyNode } from "@originos/core/types";

interface OntologyPreviewProps {
  ontology: OntologyModel;
  onConfirm: () => void;
  onEdit: () => void;
}

function OntologyNodeItem({ node, level = 0 }: { node: OntologyNode; level?: number }) {
  const typeLabels: Record<OntologyNode["type"], string> = {
    entity: "实体",
    class: "类",
    property: "属性",
    relationship: "关系",
    rule: "规则",
  };

  const typeIcons: Record<OntologyNode["type"], JSX.Element> = {
    entity: <Box className="w-4 h-4 text-primary" />,
    class: <Folder className="w-4 h-4 text-blue-500" />,
    property: <FileText className="w-4 h-4 text-teal-500" />,
    relationship: <GitBranch className="w-4 h-4 text-purple-500" />,
    rule: <FileText className="w-4 h-4 text-orange-500" />,
  };

  return (
    <div className="space-y-2" style={{ marginLeft: `${level * 24}px` }}>
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
        {typeIcons[node.type]}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{node.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {typeLabels[node.type]}
            </span>
          </div>
          {node.description && (
            <p className="text-sm text-muted-foreground mt-1">{node.description}</p>
          )}
        </div>
      </div>
      {node.children?.map((child) => (
        <OntologyNodeItem key={child.id} node={child} level={level + 1} />
      ))}
    </div>
  );
}

export function OntologyPreview({ ontology, onConfirm, onEdit }: OntologyPreviewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-3xl shadow-xl max-h-[90vh] flex flex-col">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl text-foreground">本体模型已生成！</CardTitle>
              <CardDescription className="text-muted-foreground">
                我们已根据你的回答生成了一个项目本体
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
              <h3 className="font-semibold text-lg text-foreground">{ontology.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{ontology.description}</p>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                结构 ({ontology.nodes.length} 顶级项)
              </h4>
              <div className="space-y-2 p-4 rounded-lg border bg-card">
                {ontology.nodes.map((node) => (
                  <OntologyNodeItem key={node.id} node={node} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-4 pt-4 border-t">
            <Button onClick={onEdit} variant="outline" className="flex-1 h-12 border-border text-muted-foreground hover:border-primary hover:text-foreground">
              <Edit className="mr-2 w-4 h-4" />
              编辑本体
            </Button>
            <Button onClick={onConfirm} className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-lg shadow-primary/25" size="lg">
              <Check className="mr-2 w-4 h-4" />
              确认并继续
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
