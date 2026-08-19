# Portal Digitale Têxtil (Vendas)

Sistema web corporativo com autenticação hierárquica e controle de acesso granular para a gestão comercial, produtos e força de vendas da **Digitale Têxtil**.

🌐 **Portfólio do Desenvolvedor:** [porfolioleoliveira.lovable.app](https://porfolioleoliveira.lovable.app)

---

## 📌 Sobre o Projeto

O **Portal-Digitale** foi desenvolvido para centralizar o ecossistema comercial da empresa em uma plataforma segura, responsiva e intuitiva. O sistema é dividido em módulos com permissões baseadas no perfil do usuário:

* **Administrador:** Acesso total à gestão de usuários, logs de atividade, controle de permissões e cadastro/organização de catálogo e preços.
* **Gerente:** Acesso a dados comerciais, relatórios, métricas de desempenho e conteúdos destinados à gerência e vendedores.
* **Vendedor:** Interface simplificada focada em consulta de produtos liberados, downloads de fichas técnicas/imagens e acompanhamento de catálogo.

---

## ⚡ Principais Funcionalidades

* **Gerenciamento de Usuários:** Cadastro completo, redefinição de senhas e atribuição de cargos (Admin, Gerente, Vendedor).
* **Gestão de Conteúdo e Produtos:** Cadastro de produtos com imagens, fichas técnicas em PDF, preços, condições comerciais e tags de visibilidade.
* **Autenticação e Segurança:** Sistema de login com hash de senha, controle de tempo de sessão e auditoria de ações via logs.
* **Navegação e UX:** Interface responsiva em layout dark/azul corporativo, sidebar de navegação, busca avançada e filtros por relevância/rank.

---

## 🛠️ Tecnologias Utilizadas

* **Frontend:** TypeScript, React, Vite, Tailwind CSS, shadcn/ui
* **Backend & Banco de Dados:** Supabase (PL/pgSQL)
* **Gerenciador de Pacotes:** Bun / npm
* **Desenvolvimento Acelerado:** Lovable

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
Certifique-se de ter o **Node.js** e o **npm** (ou **Bun**) instalados em sua máquina.

### Passo a Passo

1. **Clonar o repositório:**
   ```bash
   git clone [https://github.com/RennanLucas/Portal-Digitale.git](https://github.com/RennanLucas/Portal-Digitale.git)
