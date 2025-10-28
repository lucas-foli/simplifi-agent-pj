import { useState, useCallback } from 'react';
import { Upload, X, FileText, Image, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface FileUploadProps {
  onUploadSuccess?: (files: UploadedFile[]) => void;
  onTransactionsExtracted?: (transactions: ProcessedTransaction[]) => void;
  onFixedCostsExtracted?: (fixedCosts: ProcessedFixedCost[]) => void;
  importType?: 'transactions' | 'fixed_costs';
  maxFiles?: number;
  maxSizeMB?: number;
}

interface ProcessedFixedCost {
  description: string;
  amount: number;
  category_id?: string;
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
}

interface ProcessedTransaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  payment_method?: string;
}

const ACCEPTED_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/json': ['.json'],
  'application/x-ofx': ['.ofx'],
};

export const FileUpload = ({ 
  onUploadSuccess,
  onTransactionsExtracted, 
  maxFiles = 5, 
  maxSizeMB = 50 
}: FileUploadProps) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!Object.keys(ACCEPTED_TYPES).includes(file.type)) {
      return `Tipo de arquivo não suportado: ${file.type}`;
    }

    // Check file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      return `Arquivo muito grande: ${sizeMB.toFixed(1)}MB (máximo: ${maxSizeMB}MB)`;
    }

    return null;
  };

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(newFiles).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else if (files.length + validFiles.length < maxFiles) {
        validFiles.push(file);
      } else {
        errors.push(`Limite de ${maxFiles} arquivos atingido`);
      }
    });

    if (errors.length > 0) {
      toast.error(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }
  }, [files.length, maxFiles, maxSizeMB]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (!user) {
      toast.error('Você precisa estar logado para fazer upload');
      return;
    }

    if (files.length === 0) {
      toast.error('Nenhum arquivo selecionado');
      return;
    }

    setUploading(true);

    try {
      const uploadedFiles: UploadedFile[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('uploads')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          throw error;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(fileName);

        uploadedFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          url: publicUrl,
          path: fileName,
        });
      }

      toast.success(`${uploadedFiles.length} arquivo(s) enviado(s) com sucesso!`);
      
      if (onUploadSuccess) {
        onUploadSuccess(uploadedFiles);
      }

      // Process uploaded files
      if (onTransactionsExtracted) {
        await processFiles(uploadedFiles);
      }

      setFiles([]);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload dos arquivos');
    } finally {
      setUploading(false);
    }
  };

  const processFiles = async (uploadedFiles: UploadedFile[]) => {
    setProcessing(true);
    toast.info('Processando arquivos...');

    try {
      const allTransactions: ProcessedTransaction[] = [];

      for (const file of uploadedFiles) {
        const { data, error } = await supabase.functions.invoke('process-upload', {
          body: {
            filePath: file.path,
            fileType: file.type,
            userId: user!.id,
          },
        });

        if (error) {
          console.error('Error processing file:', error);
          toast.error(`Erro ao processar ${file.name}`);
          continue;
        }

        if (data?.success && data.transactions) {
          allTransactions.push(...data.transactions);
          toast.success(`${data.count} transações extraídas de ${file.name}`);
        }
      }

      if (allTransactions.length > 0 && onTransactionsExtracted) {
        onTransactionsExtracted(allTransactions);
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Erro ao processar arquivos');
    } finally {
      setProcessing(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <Image className="w-8 h-8" />;
    if (type.includes('pdf')) return <FileText className="w-8 h-8" />;
    if (type.includes('spreadsheet') || type.includes('csv') || type.includes('excel')) {
      return <FileSpreadsheet className="w-8 h-8" />;
    }
    return <FileText className="w-8 h-8" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragActive ? 'border-primary bg-primary/5' : 'border-border'}
          ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary'}
        `}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          accept={Object.values(ACCEPTED_TYPES).flat().join(',')}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">
            Arraste arquivos aqui ou clique para selecionar
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Suportados: CSV, Excel, PDF, OFX, JPG, PNG, JSON
          </p>
          <p className="text-xs text-muted-foreground">
            Máximo: {maxFiles} arquivos • {maxSizeMB}MB por arquivo
          </p>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Arquivos selecionados:</h4>
          {files.map((file, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getFileIcon(file.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)} • {file.type.split('/')[1].toUpperCase()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex gap-2">
          <Button
            onClick={uploadFiles}
            disabled={uploading}
            className="flex-1"
          >
            {uploading ? 'Enviando...' : `Enviar ${files.length} arquivo(s)`}
          </Button>
          <Button
            variant="outline"
            onClick={() => setFiles([])}
            disabled={uploading}
          >
            Limpar
          </Button>
        </div>
      )}

      {/* Info */}
      <Card className="p-4 bg-muted/50">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Dica:</strong> Após o upload, você poderá revisar e editar as transações extraídas antes de salvá-las.</p>
            <p>Arquivos são processados automaticamente e as transações são categorizadas por IA.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
