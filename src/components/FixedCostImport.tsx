import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FixedCostReview } from './FixedCostReview';

interface FixedCost {
  description: string;
  amount: number;
  category_id?: string;
}

export const FixedCostImport = () => {
  const [extractedCosts, setExtractedCosts] = useState<FixedCost[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Apenas arquivos CSV são suportados');
      return;
    }

    setProcessing(true);

    try {
      const text = await file.text();
      const costs = parseCSV(text);
      
      if (costs.length === 0) {
        toast.error('Nenhum custo fixo encontrado no arquivo');
        return;
      }

      setExtractedCosts(costs);
      toast.success(`${costs.length} custo(s) fixo(s) extraído(s)!`);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Erro ao processar arquivo CSV');
    } finally {
      setProcessing(false);
      // Reset input
      event.target.value = '';
    }
  };

  const parseCSV = (text: string): FixedCost[] => {
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV vazio ou inválido');
    }

    // Parse header
    const header = lines[0].split(/[,;]/).map(h => h.toLowerCase().trim());
    
    // Find column indices
    const descIdx = header.findIndex(h => 
      h.includes('descri') || h.includes('nome') || h.includes('description')
    );
    const amountIdx = header.findIndex(h => 
      h.includes('valor') || h.includes('amount') || h.includes('preco')
    );

    if (descIdx === -1 || amountIdx === -1) {
      throw new Error('Colunas obrigatórias não encontradas. Necessário: descrição e valor');
    }

    // Parse rows
    const costs: FixedCost[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(/[,;]/);
      
      try {
        const description = row[descIdx]?.trim();
        const amountStr = row[amountIdx]?.trim().replace(/[^\d,.-]/g, '').replace(',', '.');
        
        if (!description || !amountStr) continue;

        const amount = Math.abs(parseFloat(amountStr));
        
        if (isNaN(amount)) continue;

        costs.push({
          description,
          amount,
        });
      } catch (err) {
        console.error(`Error parsing row ${i}:`, err);
        continue;
      }
    }

    return costs;
  };

  if (extractedCosts.length > 0) {
    return (
      <FixedCostReview
        fixedCosts={extractedCosts}
        onSave={() => setExtractedCosts([])}
        onCancel={() => setExtractedCosts([])}
      />
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Importar Custos Fixos</h3>
          <p className="text-sm text-muted-foreground">Envie um arquivo CSV com seus custos mensais</p>
        </div>
      </div>

      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        <input
          type="file"
          id="fixed-cost-upload"
          accept=".csv"
          onChange={handleFileUpload}
          className="hidden"
          disabled={processing}
        />
        
        <label htmlFor="fixed-cost-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">
            {processing ? 'Processando...' : 'Clique para selecionar arquivo CSV'}
          </h3>
          <p className="text-sm text-muted-foreground mb-2">
            Formato: descrição, valor
          </p>
          <p className="text-xs text-muted-foreground">
            Exemplo: Aluguel, 1500.00
          </p>
        </label>
      </div>

      <Card className="p-4 bg-muted/50 mt-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Formato do CSV:</strong></p>
            <p>Linha 1: descrição,valor</p>
            <p>Linha 2+: Aluguel,1500.00</p>
            <p className="mt-2">Os custos fixos são despesas mensais recorrentes como aluguel, internet, etc.</p>
          </div>
        </div>
      </Card>
    </Card>
  );
};
