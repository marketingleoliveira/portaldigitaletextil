import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Monitor, AppWindow, Globe, Tv } from "lucide-react";

export type ScreenShareType = "screen" | "window" | "tab";

interface ScreenShareOptionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: ScreenShareType) => void;
}

const options = [
  {
    type: "screen" as ScreenShareType,
    icon: Monitor,
    title: "Tela inteira",
    description: "Compartilha toda a tela do seu monitor",
  },
  {
    type: "window" as ScreenShareType,
    icon: AppWindow,
    title: "Janela de aplicativo",
    description: "Compartilha apenas uma janela específica",
  },
  {
    type: "tab" as ScreenShareType,
    icon: Globe,
    title: "Aba do navegador",
    description: "Compartilha uma aba específica do navegador",
  },
];

export function ScreenShareOptionsModal({
  open,
  onOpenChange,
  onSelect,
}: ScreenShareOptionsModalProps) {
  const [selectedType, setSelectedType] = useState<ScreenShareType | null>(null);

  const handleSelect = (type: ScreenShareType) => {
    setSelectedType(type);
  };

  const handleConfirm = () => {
    if (selectedType) {
      onSelect(selectedType);
      onOpenChange(false);
      setSelectedType(null);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedType(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            Compartilhar tela
          </DialogTitle>
          <DialogDescription>
            Escolha o que você deseja compartilhar
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedType === option.type;
            
            return (
              <button
                key={option.type}
                onClick={() => handleSelect(option.type)}
                className={`
                  flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left
                  ${isSelected 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
              >
                <div className={`
                  p-3 rounded-full 
                  ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}
                `}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{option.title}</h3>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedType}>
            Compartilhar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
