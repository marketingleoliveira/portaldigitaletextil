import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MapPin, Clock, CalendarDays } from "lucide-react";
import { format, isSameDay, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Fixture {
  date: string; // ISO yyyy-mm-dd
  timeLocal: string; // HH:mm (horário local da sede)
  group: string;
  home: string;
  away: string;
  venue: string;
  city: string;
}

// Calendário oficial parcial — Copa do Mundo FIFA 2026 (11/06 a 19/07)
// Foco: dia de abertura + todos os jogos do Brasil na fase de grupos
const FIXTURES: Fixture[] = [
  { date: "2026-06-11", timeLocal: "19:00", group: "A", home: "México", away: "África do Sul", venue: "Estádio Cidade do México", city: "Cidade do México" },
  { date: "2026-06-13", timeLocal: "18:00", group: "C", home: "Brasil", away: "Marrocos", venue: "MetLife Stadium", city: "New York / New Jersey" },
  { date: "2026-06-19", timeLocal: "20:30", group: "C", home: "Brasil", away: "Haiti", venue: "Lincoln Financial Field", city: "Philadelphia" },
  { date: "2026-06-24", timeLocal: "18:00", group: "C", home: "Escócia", away: "Brasil", venue: "Hard Rock Stadium", city: "Miami" },
];

const isBrazil = (m: Fixture) => m.home === "Brasil" || m.away === "Brasil";

const FlagBR = () => (
  <span title="Brasil" className="inline-flex items-center justify-center w-6 h-4 rounded-sm bg-[hsl(120,70%,35%)] text-[10px] font-bold text-yellow-300 leading-none">
    BR
  </span>
);

const TeamLabel = ({ name }: { name: string }) => (
  <span className="inline-flex items-center gap-1.5">
    {name === "Brasil" && <FlagBR />}
    <span className={name === "Brasil" ? "font-semibold text-foreground" : "text-foreground"}>{name}</span>
  </span>
);

const MatchRow = ({ m, highlight }: { m: Fixture; highlight?: boolean }) => (
  <div
    className={`flex flex-col gap-1.5 rounded-lg border p-3 transition-colors ${
      highlight
        ? "border-[hsl(120,60%,40%)]/40 bg-[hsl(120,60%,40%)]/5"
        : "border-border bg-muted/30"
    }`}
  >
    <div className="flex items-center justify-between">
      <Badge variant="outline" className="text-[10px] font-medium">
        Grupo {m.group}
      </Badge>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        {m.timeLocal}
      </div>
    </div>
    <div className="flex items-center justify-between text-sm">
      <TeamLabel name={m.home} />
      <span className="text-xs text-muted-foreground px-2">vs</span>
      <TeamLabel name={m.away} />
    </div>
    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <MapPin className="w-3 h-3" />
      <span className="truncate">{m.venue} — {m.city}</span>
    </div>
  </div>
);

export default function WorldCup2026Card() {
  const now = new Date();
  const today = FIXTURES.filter((m) => isSameDay(parseISO(m.date), now));
  const upcoming = FIXTURES.filter((m) => isAfter(parseISO(m.date), now));
  const nextBrazil = upcoming.find(isBrazil);

  return (
    <Card className="border-[hsl(120,60%,40%)]/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[hsl(45,90%,50%)]" />
          Jogos de Hoje
          <Badge variant="secondary" className="ml-auto text-[10px] uppercase tracking-wide">
            Copa do Mundo FIFA 2026
          </Badge>
        </CardTitle>
        <CardDescription>
          Acompanhe a jornada do Brasil na Copa — Vamos, Seleção!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {today.length > 0 ? (
          <div className="space-y-2">
            {today.map((m, i) => (
              <MatchRow key={i} m={m} highlight={isBrazil(m)} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <CalendarDays className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum jogo da Copa hoje.
            </p>
          </div>
        )}

        {nextBrazil && !today.some(isBrazil) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Próximo jogo do Brasil
            </p>
            <MatchRow m={nextBrazil} highlight />
            <p className="text-[11px] text-muted-foreground text-center">
              {format(parseISO(nextBrazil.date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
