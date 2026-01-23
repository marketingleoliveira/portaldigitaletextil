import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, SparklesIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CarnivalToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

const CarnivalToggle: React.FC<CarnivalToggleProps> = ({ enabled, onToggle }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={`relative transition-all duration-300 ${
              enabled 
                ? 'text-amber-400 hover:text-amber-300 animate-carnival-glow' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {enabled ? (
              <Sparkles className="w-5 h-5" />
            ) : (
              <SparklesIcon className="w-5 h-5 opacity-50" />
            )}
            {enabled && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{enabled ? 'Desativar confetes 🎊' : 'Ativar confetes 🎭'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CarnivalToggle;
