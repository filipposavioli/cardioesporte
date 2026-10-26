import { describe, expect, it } from "vitest";
import {
  LIMITE_BYTES,
  nomesUnicos,
  rotuloSituacao,
  sanitizarNome,
  tipoConteudo,
  validarArquivo,
} from "@/lib/arquivos";

const MB = 1024 * 1024;

describe("validarArquivo", () => {
  it("aceita PDF, JPEG, PNG, HEIC", () => {
    expect(validarArquivo({ name: "exame.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(validarArquivo({ name: "foto.jpg", type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validarArquivo({ name: "foto.png", type: "image/png", size: 1000 })).toBeNull();
    expect(validarArquivo({ name: "foto.heic", type: "image/heic", size: 1000 })).toBeNull();
    expect(validarArquivo({ name: "foto.heif", type: "image/heif", size: 1000 })).toBeNull();
  });

  it("aceita HEIC sem MIME", () => {
    expect(validarArquivo({ name: "IMG_1.HEIC", type: "", size: 1000 })).toBeNull();
    expect(validarArquivo({ name: "IMG_2.heic", type: "application/octet-stream", size: 1000 })).toBeNull();
  });

  it("rejeita .docx", () => {
    const msg = validarArquivo({
      name: "laudo.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 1000,
    });
    expect(msg).toMatch(/laudo\.docx/);
    expect(msg).toMatch(/PDF, JPEG, PNG ou HEIC/);
    // Sem MIME, a extensão decide.
    expect(validarArquivo({ name: "laudo.docx", type: "", size: 1000 })).not.toBeNull();
    // MIME de imagem não aceita (GIF) também é recusado.
    expect(validarArquivo({ name: "a.gif", type: "image/gif", size: 1000 })).not.toBeNull();
  });

  it("rejeita 21 MB", () => {
    const msg = validarArquivo({ name: "grande.pdf", type: "application/pdf", size: 21 * MB });
    expect(msg).toMatch(/20 MB/);
    expect(msg).toMatch(/grande\.pdf/);
    expect(validarArquivo({ name: "limite.pdf", type: "application/pdf", size: LIMITE_BYTES })).toBeNull();
  });

  it("rejeita arquivo vazio", () => {
    expect(validarArquivo({ name: "vazio.pdf", type: "application/pdf", size: 0 })).toMatch(/vazio/);
  });
});

describe("tipoConteudo", () => {
  it("usa o MIME do navegador ou deduz pela extensão", () => {
    expect(tipoConteudo({ name: "a.pdf", type: "application/pdf" })).toBe("application/pdf");
    expect(tipoConteudo({ name: "IMG_1.HEIC", type: "" })).toBe("image/heic");
    expect(tipoConteudo({ name: "x.heif", type: "application/octet-stream" })).toBe("image/heif");
    expect(tipoConteudo({ name: "x.JPG", type: "" })).toBe("image/jpeg");
  });
});

describe("sanitizarNome", () => {
  it("mantém só o nome-base e a extensão", () => {
    expect(sanitizarNome("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizarNome("C:\\Users\\ana\\exame.PDF")).toBe("exame.pdf");
  });

  it("tira acentos, espaços, controle e caracteres fora do conjunto seguro", () => {
    expect(sanitizarNome("Hemograma de março (1).pdf")).toBe("Hemograma-de-marco-1.pdf");
    expect(sanitizarNome("a\u0000b\u001f\nc.png")).toBe("abc.png");
    expect(sanitizarNome("exame 💓 final.jpg")).toBe("exame-final.jpg");
  });

  it("nunca devolve nome vazio, '.' ou '..'", () => {
    expect(sanitizarNome("")).toBe("arquivo");
    expect(sanitizarNome("..")).toBe("arquivo");
    expect(sanitizarNome(".pdf")).toBe("arquivo.pdf");
    expect(sanitizarNome("💓.heic")).toBe("arquivo.heic");
    expect(sanitizarNome("/")).toBe("arquivo");
  });

  it("limita o tamanho preservando a extensão", () => {
    const nome = sanitizarNome("a".repeat(300) + ".pdf");
    expect(nome.length).toBeLessThanOrEqual(100);
    expect(nome.endsWith(".pdf")).toBe(true);
  });
});

describe("nomesUnicos", () => {
  it("numera repetidos antes da extensão", () => {
    expect(nomesUnicos(["a.pdf", "a.pdf", "b.png", "a.pdf", "A.pdf"])).toEqual([
      "a.pdf",
      "a-2.pdf",
      "b.png",
      "a-3.pdf",
      "A-4.pdf",
    ]);
  });

  it("não colide com um nome que já tem o sufixo", () => {
    expect(nomesUnicos(["a-2.pdf", "a.pdf", "a.pdf"])).toEqual(["a-2.pdf", "a.pdf", "a-3.pdf"]);
  });
});

describe("rotuloSituacao", () => {
  it("traduz as situações", () => {
    expect(rotuloSituacao("recebido")).toBe("Recebido");
    expect(rotuloSituacao("incorporado")).toBe("Incorporado ao painel");
  });
});
