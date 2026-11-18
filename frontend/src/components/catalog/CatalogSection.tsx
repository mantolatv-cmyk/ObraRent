'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { CategoryCard } from '@/components/catalog/CategoryCard';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, errorMessage } from '@/lib/api';
import { whatsappLink } from '@/lib/config';
import type { Category } from '@/lib/types';

export interface CatalogSectionProps {
  initialCategories: Category[] | null;
  initialError?: string | null;
}

export function CatalogSection({ initialCategories, initialError }: CatalogSectionProps) {
  const [categories, setCategories] = useState<Category[] | null>(initialCategories);
  const [loading, setLoading] = useState<boolean>(!initialCategories);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.categories();
      setCategories(data);
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível carregar o catálogo agora.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialCategories) {
      void loadCategories();
    }
  }, [initialCategories, loadCategories]);

  return (
    <section aria-labelledby="catalogo-title" className="mt-6 sm:mt-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="catalogo-title" className="text-xl sm:text-2xl font-bold text-white">
            Catálogo de Equipamentos
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
            Estoque físico monitorado em tempo real
          </p>
        </div>
        {categories && categories.length > 0 ? (
          <Badge tone="accent" dot className="tabular-nums text-xs">
            {categories.length} disponíveis
          </Badge>
        ) : null}
      </div>

      {loading && !categories ? (
        <div
          className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Carregando catálogo de equipamentos"
        >
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      ) : !categories ? (
        <Alert
          tone="warning"
          className="mt-4"
          title="Não foi possível carregar o catálogo agora"
          action={
            <div className="flex flex-wrap gap-3">
              <Button variant="dark" loading={loading} onClick={() => void loadCategories()}>
                <RefreshCw aria-hidden className="h-4 w-4" />
                Tentar novamente
              </Button>
              <a
                href={whatsappLink('alugar')}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: 'secondary' })}
              >
                Alugar pelo WhatsApp
              </a>
            </div>
          }
        >
          <span className="flex items-center gap-2">
            <WifiOff aria-hidden className="h-4 w-4" /> {error || 'Sem conexão com o servidor.'}
          </span>
        </Alert>
      ) : categories.length === 0 ? (
        <Alert tone="info" className="mt-4" title="Nenhum equipamento cadastrado ainda">
          Fale com a gente pelo WhatsApp para uma cotação personalizada.
        </Alert>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </ul>
      )}
    </section>
  );
}
