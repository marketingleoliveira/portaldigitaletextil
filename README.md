# Portal Digitale Têxtil ( VENDAS ) 

Título do Projeto: Portal Comercial Digitale Têxtil

Descrição do Sistema:

Crie um sistema de portal web com autenticação hierárquica para a empresa Digitale Têxtil, composto por dois módulos principais:

1. Painel de Administração
Acesso exclusivo via login administrativo

Funcionalidades:

Gerenciamento de Usuários:

Cadastro de novos vendedores e gerentes

Campos obrigatórios: nome completo, email, cargo (dropdown), telefone

Geração automática de senha inicial

Ativação/desativação de contas

Reset de senha

Sistema de Hierarquia (Ranks):

3 níveis de acesso:

Administrador - Acesso total

Gerente - Acesso a dados essenciais + conteúdo marcado como "gerência"

Vendedor - Acesso apenas ao conteúdo liberado especificamente

Gerenciamento de Conteúdo/Produtos:

Cadastro de produtos com:

Nome do produto

Descrição

Imagens/catálogo digital

Fichas técnicas (PDF)

Preços e condições comerciais

Sistema de Tags de Visibilidade:

Checkbox/multiselect para definir quais ranks podem visualizar

Ex: "Vendedor", "Gerente", "Administrador"

Organização por categorias/coleções

Dashboard Administrativo:

Estatísticas de acesso

Logs de atividades

Controle de visualizações por rank

2. Portal de Acesso para Vendedores/Gerentes
Tela de login com email e senha

Interface responsiva e clean

Após login, redirecionamento baseado no rank:

Para VENDEDORES:

Dashboard simplificado

Acesso apenas aos produtos/conteúdos marcados como "visível para vendedores"

Área de downloads restrita

Perfil pessoal para alteração de senha

Para GERENTES:

Dashboard com métricas essenciais

Acesso a produtos marcados como "visível para gerentes" + conteúdo de vendedores

Relatórios básicos

Ferramentas de análise comercial

Para ADMINISTRADORES:

Link direto para o Painel de Administração

Acesso total a todo o conteúdo

Controle de permissões

3. Requisitos Técnicos
Autenticação Segura: Sistema de login com hash de senhas

Sessões: Controle de tempo de sessão

Responsividade: Mobile-friendly

Área de Downloads: Organizada por categorias, com filtro por rank

Sistema de Notificações: Para comunicações internas (apenas para ranks permitidos)

Busca: Funcionalidade de busca com filtros por rank

4. Design e Interface
Cores principais: Azul corporativo (#1e40af) e branco

Logo da Digitale Têxtil no header

Layout intuitivo com sidebar navigation

Cards para produtos com indicador visual do nível de acesso

5. Fluxos Principais
Admin cadastra usuário → usuário recebe credenciais → faz login → vê conteúdo conforme seu rank

Admin cadastra produto → seleciona ranks de visualização → produto aparece apenas para os ranks selecionados

Gerente acessa → vê conteúdo de gerente + conteúdo de vendedor

Vendedor acessa → vê apenas conteúdo liberado para vendedores

Observações para a IA Lovable.dev:

Criar estrutura de banco de dados com tabelas: users, products, categories, permissions, access_logs

Implementar middleware de verificação de rank em todas as rotas

Criar sistema de permissões baseado em roles (RBAC)

Gerar interfaces separadas para cada nível de acesso

Incluir exemplos de dados mock para teste

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://portaldigitaletextil.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/66a0086f-3a9f-4b49-95c6-10c5f61c45e0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
