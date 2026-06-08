import Agendamentos from "./Agendamentos";

export default function AgendamentosCRM() {
  return (
    <Agendamentos
      scope="crm"
      title="Agendamentos CRM"
      subtitle="Troféus e Lembretes de Retorno dos leads do CRM"
      redirectTo="/crm-alimentador"
    />
  );
}
