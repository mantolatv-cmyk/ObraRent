'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { CompanyDeliveryStep } from '@/components/checkout/CompanyDeliveryStep';
import { DatesStep } from '@/components/checkout/DatesStep';
import { EquipmentStep } from '@/components/checkout/EquipmentStep';
import { OrderSummarySidebar } from '@/components/checkout/OrderSummarySidebar';
import { PaymentStep } from '@/components/checkout/PaymentStep';
import {
  checkoutReducer,
  computeLocalEstimate,
  createInitialCheckoutState,
  STEP_LABELS,
  STORAGE_KEY,
  validateStep3,
  type AddressFormState,
  type CheckoutState,
  type CheckoutStep,
  type ClientFormState,
  type Step3Errors,
} from '@/components/checkout/state';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { useAvailability } from '@/hooks/useAvailability';
import { useCategories } from '@/hooks/useCategories';
import { useQuote } from '@/hooks/useQuote';
import { api, errorMessage, isApiError } from '@/lib/api';
import { inclusiveDays, onlyDigits, todayISO } from '@/lib/format';
import { isValidCep } from '@/lib/validation';
import type { Category, QuoteRequest, RentalSummary } from '@/lib/types';

export interface CheckoutWizardProps {
  initialCategories?: Category[] | null;
}

export function CheckoutWizard({ initialCategories }: CheckoutWizardProps) {
  const searchParams = useSearchParams();
  const categoriaParam = searchParams.get('categoria');

  const {
    categories,
    loading: categoriesLoading,
    error: categoriesError,
    reload: reloadCategories,
  } = useCategories(initialCategories);

  const [state, dispatch] = useReducer(checkoutReducer, undefined, createInitialCheckoutState);
  const [hydrated, setHydrated] = useState(false);
  const [showStep3Validation, setShowStep3Validation] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<Step3Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const appliedParamRef = useRef<string | null>(null);

  // 1. Hydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CheckoutState>;
        dispatch({ type: 'HYDRATE', state: parsed });
      }
    } catch {
      // sessionStorage unavailable or corrupted
    } finally {
      setHydrated(true);
    }
  }, []);

  // 2. Persist state to sessionStorage after hydration
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state, hydrated]);

  // 3. Preselect category from ?categoria=<id|slug>
  useEffect(() => {
    if (!hydrated || !categoriaParam || categories.length === 0) return;
    if (appliedParamRef.current === categoriaParam) return;

    const match = categories.find(
      (c) => c.id === categoriaParam || c.slug.toLowerCase() === categoriaParam.toLowerCase(),
    );
    if (!match) return;
    appliedParamRef.current = categoriaParam;

    if (state.step === 3) {
      dispatch({ type: 'RESET' });
      dispatch({ type: 'SET_QUANTITY', categoryId: match.id, quantity: 1 });
      return;
    }

    if ((state.quantities[match.id] ?? 0) === 0) {
      dispatch({ type: 'SET_QUANTITY', categoryId: match.id, quantity: 1 });
    }
  }, [hydrated, categoriaParam, categories, state.step, state.quantities]);

  const selectedCategories = useMemo(
    () =>
      categories
        .filter((cat) => (state.quantities[cat.id] ?? 0) > 0)
        .map((category) => ({ category, quantity: state.quantities[category.id] ?? 0 })),
    [categories, state.quantities],
  );

  const estimate = useMemo(
    () => computeLocalEstimate(categories, state.quantities, state.startDate, state.endDate),
    [categories, state.quantities, state.startDate, state.endDate],
  );

  // Real-time availability check
  const availability = useAvailability({
    startDate: state.startDate,
    endDate: state.endDate,
    enabled: selectedCategories.length > 0 && state.step >= 1 && state.step < 3,
  });

  // Live server quote
  const quoteRequest = useMemo<QuoteRequest | null>(() => {
    if (selectedCategories.length === 0 || state.step === 3) return null;
    const days = inclusiveDays(state.startDate, state.endDate);
    if (days <= 0) return null;
    const cepDigits = onlyDigits(state.address.cep);
    return {
      startDate: state.startDate,
      endDate: state.endDate,
      paymentMethod: state.paymentMethod,
      items: selectedCategories.map(({ category, quantity }) => ({
        categoryId: category.id,
        quantity,
      })),
      deliveryAddress: isValidCep(cepDigits)
        ? {
            cep: cepDigits,
            street: state.address.street || undefined,
            number: state.address.number || undefined,
            district: state.address.district || undefined,
            city: state.address.city || undefined,
            state: state.address.state || undefined,
          }
        : undefined,
    };
  }, [
    selectedCategories,
    state.step,
    state.startDate,
    state.endDate,
    state.paymentMethod,
    state.address.cep,
    state.address.street,
    state.address.number,
    state.address.district,
    state.address.city,
    state.address.state,
  ]);

  const { quote, loading: quoteLoading, error: quoteError } = useQuote(quoteRequest);

  // Step 2 validation: dates valid + all requested quantities <= available
  const today = todayISO();
  const datesValid =
    state.startDate >= today &&
    state.endDate >= state.startDate &&
    inclusiveDays(state.startDate, state.endDate) > 0;

  const hasAvailabilityShortfall = useMemo(() => {
    if (selectedCategories.length === 0) return true;
    for (const { category, quantity } of selectedCategories) {
      const avail = availability.byCategory(category.id);
      const maxAvail = avail ? avail.availableCount : category.operationalUnits;
      if (quantity > maxAvail) return true;
    }
    return false;
  }, [selectedCategories, availability]);

  const step3ValidationErrors = useMemo<Step3Errors>(() => {
    if (!showStep3Validation) return serverFieldErrors;
    return {
      ...validateStep3(state.client, state.address),
      ...serverFieldErrors,
    };
  }, [showStep3Validation, state.client, state.address, serverFieldErrors]);

  const handleQuantityChange = useCallback((categoryId: string, quantity: number) => {
    dispatch({ type: 'SET_QUANTITY', categoryId, quantity });
  }, []);

  const handleDatesChange = useCallback((startDate: string, endDate: string) => {
    dispatch({ type: 'SET_DATES', startDate, endDate });
  }, []);

  const handlePatchClient = useCallback((patch: Partial<ClientFormState>) => {
    setServerFieldErrors({});
    setSubmitError(null);
    dispatch({ type: 'PATCH_CLIENT', patch });
  }, []);

  const handlePatchAddress = useCallback((patch: Partial<AddressFormState>) => {
    setServerFieldErrors({});
    setSubmitError(null);
    dispatch({ type: 'PATCH_ADDRESS', patch });
  }, []);

  const goToStep = useCallback((step: CheckoutStep) => {
    setSubmitError(null);
    dispatch({ type: 'SET_STEP', step });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleSubmitOrder = useCallback(async () => {
    setShowStep3Validation(true);
    setServerFieldErrors({});
    setSubmitError(null);

    const localErrors = validateStep3(state.client, state.address);
    if (Object.keys(localErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createRental({
        client: {
          cnpj: onlyDigits(state.client.cnpj),
          companyName: state.client.companyName.trim(),
          tradeName: state.client.tradeName.trim() || undefined,
          email: state.client.email.trim(),
          phone: onlyDigits(state.client.phone),
        },
        startDate: state.startDate,
        endDate: state.endDate,
        items: selectedCategories.map(({ category, quantity }) => ({
          categoryId: category.id,
          quantity,
        })),
        deliveryAddress: {
          cep: onlyDigits(state.address.cep),
          street: state.address.street.trim(),
          number: state.address.number.trim(),
          complement: state.address.complement.trim() || undefined,
          district: state.address.district.trim(),
          city: state.address.city.trim(),
          state: state.address.state.trim().toUpperCase(),
          reference: state.address.reference.trim() || undefined,
        },
        paymentMethod: state.paymentMethod,
        channel: 'WEB',
        deliveryTimeSlot: state.deliveryTimeSlot || undefined,
      });

      dispatch({ type: 'RENTAL_CREATED', rental: created });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === 'INSUFFICIENT_AVAILABILITY') {
          const shortfalls = err.insufficientAvailability();
          availability.reload();
          dispatch({
            type: 'AVAILABILITY_SHORTFALL',
            shortfalls:
              shortfalls.length > 0
                ? shortfalls
                : selectedCategories.map(({ category, quantity }) => ({
                    categoryId: category.id,
                    categoryName: category.name,
                    requested: quantity,
                    available: 0,
                  })),
          });
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return;
        }

        if (err.code === 'INVALID_CNPJ') {
          setServerFieldErrors({ cnpj: err.message || 'CNPJ inválido.' });
        } else if (err.code === 'VALIDATION_ERROR') {
          const fieldMap = err.fieldErrors();
          const mapped: Step3Errors = {};
          if (fieldMap['client.cnpj']) mapped.cnpj = fieldMap['client.cnpj'];
          if (fieldMap['client.companyName']) mapped.companyName = fieldMap['client.companyName'];
          if (fieldMap['client.email']) mapped.email = fieldMap['client.email'];
          if (fieldMap['client.phone']) mapped.phone = fieldMap['client.phone'];
          if (fieldMap['deliveryAddress.cep']) mapped.cep = fieldMap['deliveryAddress.cep'];
          if (fieldMap['deliveryAddress.street']) mapped.street = fieldMap['deliveryAddress.street'];
          if (fieldMap['deliveryAddress.number']) mapped.number = fieldMap['deliveryAddress.number'];
          if (fieldMap['deliveryAddress.district']) mapped.district = fieldMap['deliveryAddress.district'];
          if (fieldMap['deliveryAddress.city']) mapped.city = fieldMap['deliveryAddress.city'];
          if (fieldMap['deliveryAddress.state']) mapped.state = fieldMap['deliveryAddress.state'];
          setServerFieldErrors(mapped);
        }
      }
      setSubmitError(errorMessage(err, 'Não foi possível criar o pedido. Verifique os dados e tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  }, [state, selectedCategories, availability]);

  const handlePrimaryAction = useCallback(() => {
    if (state.step === 0) {
      if (estimate.totalUnits > 0) goToStep(1);
    } else if (state.step === 1) {
      if (estimate.totalUnits > 0 && datesValid && !hasAvailabilityShortfall && Boolean(state.deliveryTimeSlot)) {
        goToStep(2);
      }
    } else if (state.step === 2) {
      void handleSubmitOrder();
    }
  }, [state.step, state.deliveryTimeSlot, estimate.totalUnits, datesValid, hasAvailabilityShortfall, goToStep, handleSubmitOrder]);

  const handleBack = useCallback(() => {
    if (state.step === 1) goToStep(0);
    else if (state.step === 2) goToStep(1);
  }, [state.step, goToStep]);

  const handleRentalUpdate = useCallback((rental: RentalSummary) => {
    dispatch({ type: 'RENTAL_UPDATED', rental });
  }, []);

  const handleStartNewRental = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    dispatch({ type: 'RESET' });
  }, []);

  const canContinue =
    state.step === 0
      ? estimate.totalUnits > 0
      : state.step === 1
        ? estimate.totalUnits > 0 && datesValid && !hasAvailabilityShortfall && !availability.loading && Boolean(state.deliveryTimeSlot)
        : state.step === 2
          ? estimate.totalUnits > 0 && !submitting
          : false;

  const primaryLabel =
    state.step === 0
      ? 'Escolher datas'
      : state.step === 1
        ? !state.deliveryTimeSlot
          ? 'Selecione um horário'
          : 'Informar entrega'
        : state.step === 2
          ? state.paymentMethod === 'PIX'
            ? 'Gerar Pix do pedido'
            : state.paymentMethod === 'CASH'
              ? 'Finalizar pedido (8% OFF)'
              : 'Finalizar pedido'
          : '';

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <div className="rounded-2xl border border-white/10 bg-slate-900/65 px-4 py-3 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] sm:px-6">
        <Stepper
          steps={STEP_LABELS}
          current={state.step}
          onStepClick={
            state.step < 3
              ? (idx) => {
                  if (idx < state.step) goToStep(idx as CheckoutStep);
                }
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {state.step === 0 ? (
            <EquipmentStep
              categories={categories}
              loading={categoriesLoading}
              error={categoriesError}
              onReload={reloadCategories}
              quantities={state.quantities}
              onQuantityChange={handleQuantityChange}
              onClearAll={() => dispatch({ type: 'CLEAR_QUANTITIES' })}
            />
          ) : null}

          {state.step === 1 ? (
            <DatesStep
              startDate={state.startDate}
              endDate={state.endDate}
              onDatesChange={handleDatesChange}
              deliveryTimeSlot={state.deliveryTimeSlot}
              onDeliveryTimeSlotChange={(slot) => dispatch({ type: 'SET_DELIVERY_TIME_SLOT', slot })}
              selectedCategories={selectedCategories}
              onQuantityChange={handleQuantityChange}
              availabilityByCategory={availability.byCategory}
              availabilityLoading={availability.loading}
              availabilityError={availability.error}
              onReloadAvailability={availability.reload}
              shortfalls={state.shortfalls}
            />
          ) : null}

          {state.step === 2 ? (
            <CompanyDeliveryStep
              client={state.client}
              onPatchClient={handlePatchClient}
              address={state.address}
              onPatchAddress={handlePatchAddress}
              paymentMethod={state.paymentMethod}
              onPaymentMethodChange={(method) => dispatch({ type: 'SET_PAYMENT_METHOD', method })}
              errors={step3ValidationErrors}
              submitError={submitError}
              quote={quote}
              quoteLoading={quoteLoading}
              quoteError={quoteError}
              fallbackEstimate={estimate}
              startDate={state.startDate}
              endDate={state.endDate}
              deliveryTimeSlot={state.deliveryTimeSlot}
            />
          ) : null}

          {state.step === 3 && state.createdRental ? (
            <PaymentStep
              rental={state.createdRental}
              onRentalUpdate={handleRentalUpdate}
              onStartNewRental={handleStartNewRental}
            />
          ) : null}

          {/* Desktop step footer navigation */}
          {state.step < 3 ? (
            <div className="hidden items-center justify-between gap-4 pt-2 lg:flex">
              {state.step > 0 ? (
                <Button variant="secondary" size="lg" onClick={handleBack} disabled={submitting}>
                  <ArrowLeft aria-hidden className="h-5 w-5" />
                  Voltar
                </Button>
              ) : (
                <span />
              )}
              <Button
                variant="primary"
                size="lg"
                disabled={!canContinue}
                loading={submitting}
                onClick={handlePrimaryAction}
              >
                {primaryLabel}
                <ArrowRight aria-hidden className="h-5 w-5" />
              </Button>
            </div>
          ) : null}
        </div>

        <OrderSummarySidebar
          step={state.step}
          startDate={state.startDate}
          endDate={state.endDate}
          deliveryTimeSlot={state.deliveryTimeSlot}
          paymentMethod={state.paymentMethod}
          estimate={estimate}
          quote={quote}
          quoteLoading={quoteLoading}
          canContinue={canContinue}
          submitting={submitting}
          primaryLabel={primaryLabel}
          onPrimaryAction={handlePrimaryAction}
          onBack={state.step > 0 && state.step < 3 ? handleBack : undefined}
        />
      </div>
    </div>
  );
}
