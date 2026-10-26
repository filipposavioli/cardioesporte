import { Simbolo } from "@/components/marca/Simbolo";

export function Rodape() {
  return (
    <footer className="sc-foot">
      <div className="sc-foot-in">
        <div className="sc-foot-sym">
          <Simbolo altura={40} cor="#ade736" />
        </div>
        <p className="sc-tag">Transformar a saúde começa por conhecê-la.</p>
        <p className="sc-sig">
          <b>Dr. Filippo Savioli</b> · Cardiologista do Esporte · CRM-SP 151154
          <br />
          Rua Comendador Eduardo Saccab, 215 · Brooklin · São Paulo – SP
        </p>
        <p className="sc-disc">
          Este painel resume seus exames de forma educativa e não substitui a consulta. Os resultados são interpretados
          em conjunto com sua história clínica.
        </p>
      </div>
    </footer>
  );
}
