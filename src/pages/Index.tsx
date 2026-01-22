import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { ArrowRight, Package, Users, Shield, Loader2 } from 'lucide-react';
const Index: React.FC = () => {
  const {
    user,
    loading
  } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo />
          <Button onClick={() => navigate('/login')}>
            Entrar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto animate-fade-in">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6">Portal Comercial
Digitale Têxtil<span className="text-primary block mt-2">Digitale Têxtil</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">Aqui você encontra tudo o que é necessário para que você brilhe ainda mais na sua função, o portal chegou parar revolucionar seu método de trabalho oferecendo ferramentas criativas para seu dia-a-dia de trabalho.</p>
            <Button size="lg" onClick={() => navigate('/login')} className="shadow-primary">
              Acessar Portal
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-card rounded-xl shadow-sm animate-fade-in" style={{
            animationDelay: '0.1s'
          }}>
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl gradient-primary flex items-center justify-center">
                <Package className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Arquivos para Baixar</h3>
              <p className="text-muted-foreground">Uma biblioteca de arquivos para facilitar seu dia-a-dia, chega de servidor local, o FUTURO CHEGOU!.</p>
            </div>
            <div className="text-center p-6 bg-card rounded-xl shadow-sm animate-fade-in" style={{
            animationDelay: '0.2s'
          }}>
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-success/10 flex items-center justify-center">
                <Users className="w-7 h-7 text-success" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Acesso Personalizado</h3>
              <p className="text-muted-foreground">
                Conteúdo filtrado de acordo com seu nível de acesso na empresa.
              </p>
            </div>
            <div className="text-center p-6 bg-card rounded-xl shadow-sm animate-fade-in" style={{
            animationDelay: '0.3s'
          }}>
              <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-role-admin/10 flex items-center justify-center">
                <Shield className="w-7 h-7 text-role-admin" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Seguro e Confiável</h3>
              <p className="text-muted-foreground">Sistema seguro com controle de permissões e autenticação robusta seguindo todos os parâmetros e regras da LGPD.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© {new Date().getFullYear()} Digitale Têxtil. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>;
};
export default Index;