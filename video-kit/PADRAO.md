# Padrão aprovado: vídeos do YouTube

Padrão validado pelo Dr. Filippo na amostra "Zona 2" (out/2026). Segue em todos os vídeos de
fala para câmera, salvo pedido em contrário. Detalhes técnicos em `pipeline/README.md`.

## Regra de ouro

**Nada é publicado sem confirmação explícita do Dr. Filippo.**

## Edição

- Cortar pausas acima de ~0,4 s e repetições/tropeços (manter a melhor tentativa).
- Jump cuts alternando enquadramentos tirados do 4K: aberto, médio, fechado e "esquerda"
  (médico a ~36% da largura quando entra painel à direita).
- Correção de cor leve (`pipeline/grade.txt`): menos amarelo no fundo, pele neutra, vinheta suave,
  redução de ruído. Nada de correção forte.
- Áudio: passa-alta, redução de ruído, compressor, −14 LUFS.

## Gráficos

| Elemento | Quando usar | Regra |
|---|---|---|
| Palavras-chave no gancho | Primeiros segundos | Caixas verdes entrando pela esquerda |
| Nome + CRM | ~30 s | "Dr. Filippo Savioli · Cardiologia do Esporte · CRM-SP 151.154", com fundo |
| Painel lateral | Explicações e listas | Médico em cena à esquerda; itens entram sincronizados com a fala; último item pode ir em destaque verde |
| Tela de capítulo | Cada novo bloco (ZONA 1, ZONA 2…) | **~2 s na tela**; barras de intensidade; pausa curta só se a fala não cobrir 2 s |
| Título inferior | Frase de impacto | Texto branco + caixa verde |
| Card de mito | Mitos | Frase riscada + carimbo vermelho + fato |
| Card de estudo / referência | Citações científicas | Fonte completa; conferir números no artigo |
| Curtir/inscrever | 1× no meio do vídeo + sincronizado com o CTA falado | Botões "Gostei", "Inscreva-se" e sino, com cursor clicando |
| Assinatura final | Fim | Logo verde/branco + "Seu corpo tem dados. Nós interpretamos." + "Inscreva-se no canal" |

**Não usar:** diagrama em tela cheia com o médico dentro de um círculo (PiP). Preferir painel lateral.

## Identidade

Paleta, logo e tipografia em `README.md` (paleta do moodboard; texto sobre verde sempre em azul petróleo).

## Entregáveis por vídeo

MP4 1080p · legendas `.srt` (nomes corrigidos) · thumbnail 1280×720 · lista de pontos para revisão médica.
