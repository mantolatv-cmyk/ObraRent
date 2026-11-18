'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HardHat,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth/AuthContext';
import { formatCpfOrCnpj, maskCpfOrCnpj, maskPhone, onlyDigits } from '@/lib/format';
import { isValidCpfOrCnpj } from '@/lib/validation';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/minhas-locacoes';

  const { login, register, isAuthenticated, user, logout } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regCpfCnpj, setRegCpfCnpj] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!loginIdentifier.trim()) {
      setError('Informe seu e-mail ou CPF/CNPJ.');
      return;
    }
    if (!loginPassword) {
      setError('Informe sua senha.');
      return;
    }

    setLoading(true);
    try {
      const client = await login({
        identifier: loginIdentifier,
        password: loginPassword,
      });
      setSuccessMsg(`Bem-vindo(a) de volta, ${client.tradeName || client.companyName}!`);
      setTimeout(() => {
        router.push(redirectPath);
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Credenciais inválidas. Verifique seu login e senha.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const docDigits = onlyDigits(regCpfCnpj);
    if (!isValidCpfOrCnpj(docDigits)) {
      setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }
    if (!regName.trim()) {
      setError('Informe seu nome completo ou razão social.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }
    if (regPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('A confirmação de senha não confere com a senha digitada.');
      return;
    }

    setLoading(true);
    try {
      const client = await register({
        cnpj: docDigits,
        companyName: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone ? onlyDigits(regPhone) : undefined,
        password: regPassword,
      });
      setSuccessMsg(`Conta criada com sucesso! Bem-vindo(a), ${client.companyName}!`);
      setTimeout(() => {
        router.push(redirectPath);
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // If already authenticated, show account banner
  if (isAuthenticated && user) {
    return (
      <div className="mx-auto max-w-lg space-y-6 pt-6">
        <Card className="border-yellow-400/40 bg-slate-900/80 backdrop-blur-2xl text-center shadow-[0_0_35px_rgba(250,204,21,0.15)]">
          <CardBody className="p-8 space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400/15 border border-yellow-400/40 text-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.25)]">
              <User className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Você está conectado</h2>
              <p className="text-sm font-semibold text-yellow-300">{user.companyName}</p>
              <p className="text-xs text-slate-400 font-mono">Doc: {formatCpfOrCnpj(user.cnpj)}</p>
              {user.email ? <p className="text-xs text-slate-400">{user.email}</p> : null}
            </div>

            <div className="pt-4 flex flex-col gap-2.5">
              <Button
                variant="primary"
                size="lg"
                block
                onClick={() => router.push(redirectPath)}
              >
                Acessar {redirectPath === '/alugar' ? 'Locação' : 'Minhas Locações'}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button
                variant="secondary"
                size="md"
                block
                onClick={() => logout()}
              >
                Sair desta conta
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5 pt-2 sm:pt-6">
      {/* Brand Header */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.2)]">
          <HardHat className="h-3.5 w-3.5 text-yellow-400" />
          <span>Área do Cliente Mantovani</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {mode === 'login' ? 'Acesse sua Conta' : 'Criar Conta de Cliente'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300">
          {mode === 'login'
            ? 'Acompanhe pedidos, contratos em PDF e agilize suas locações.'
            : 'Cadastre-se como Pessoa Física ou Jurídica em menos de 1 minuto.'}
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-slate-950/70 p-1 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
            setSuccessMsg(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-all ${
            mode === 'login'
              ? 'bg-yellow-400 text-slate-950 shadow-[0_0_16px_rgba(250,204,21,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <User className="h-4 w-4" />
          Entrar
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError(null);
            setSuccessMsg(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-all ${
            mode === 'register'
              ? 'bg-yellow-400 text-slate-950 shadow-[0_0_16px_rgba(250,204,21,0.35)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Cadastrar
        </button>
      </div>

      {/* Feedback Messages */}
      {error ? (
        <Alert tone="danger" title="Atenção">
          {error}
        </Alert>
      ) : null}

      {successMsg ? (
        <Alert tone="success" title="Sucesso!">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        </Alert>
      ) : null}

      {/* Form Card */}
      <Card className="border-yellow-400/25 bg-slate-900/75 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <CardBody className="p-5 sm:p-6">
          {mode === 'login' ? (
            /* LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <Field label="E-mail ou CPF / CNPJ" hint="Digite seu e-mail cadastrado ou documento">
                <Input
                  type="text"
                  placeholder="seu@email.com ou CPF/CNPJ"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  leading={<Mail className="h-4 w-4 text-slate-400" />}
                  autoComplete="username"
                  required
                />
              </Field>

              <Field label="Senha">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Sua senha secreta"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    leading={<Lock className="h-4 w-4 text-slate-400" />}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                loading={loading}
                className="mt-2"
              >
                Entrar na Mantovani
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="text-xs font-semibold text-yellow-400 hover:underline underline-offset-4"
                >
                  Ainda não tem conta? Crie seu cadastro grátis
                </button>
              </div>
            </form>
          ) : (
            /* REGISTER FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <Field label="CPF ou CNPJ" hint="Pessoa Física (11 dígitos) ou Pessoa Jurídica (14 dígitos)">
                <Input
                  type="text"
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  value={regCpfCnpj}
                  onChange={(e) => setRegCpfCnpj(maskCpfOrCnpj(e.target.value))}
                  inputMode="numeric"
                  required
                />
              </Field>

              <Field label="Nome Completo ou Razão Social">
                <Input
                  type="text"
                  placeholder="Ex: Carlos Eduardo ou Delta Construções"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  leading={<User className="h-4 w-4 text-slate-400" />}
                  required
                />
              </Field>

              <Field label="E-mail">
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  leading={<Mail className="h-4 w-4 text-slate-400" />}
                  autoComplete="email"
                  required
                />
              </Field>

              <Field label="Celular / WhatsApp">
                <Input
                  type="tel"
                  placeholder="(11) 98765-4321"
                  value={regPhone}
                  onChange={(e) => setRegPhone(maskPhone(e.target.value))}
                  leading={<Phone className="h-4 w-4 text-slate-400" />}
                  inputMode="tel"
                  required
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Senha" hint="Mínimo 6 caracteres">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Criar senha"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    leading={<Lock className="h-4 w-4 text-slate-400" />}
                    autoComplete="new-password"
                    required
                  />
                </Field>

                <Field label="Confirmar Senha">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repita a senha"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    leading={<Lock className="h-4 w-4 text-slate-400" />}
                    autoComplete="new-password"
                    required
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center gap-1.5 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>{showPassword ? 'Ocultar senhas' : 'Ver senhas digitadas'}</span>
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                loading={loading}
                className="mt-2"
              >
                Concluir Cadastro
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="text-xs font-semibold text-yellow-400 hover:underline underline-offset-4"
                >
                  Já possui conta? Clique para entrar
                </button>
              </div>
            </form>
          )}

          <div className="mt-5 border-t border-white/10 pt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Dados protegidos com criptografia ponta a ponta</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <SiteHeader showRentCta={false} />
      <main id="conteudo" className="mx-auto max-w-content px-4 pb-20 pt-4 sm:px-6 sm:pb-16 sm:pt-8">
        <Suspense fallback={<div className="text-center text-slate-400 py-12">Carregando formulário...</div>}>
          <LoginContent />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
