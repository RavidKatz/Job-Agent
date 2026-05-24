function splitBuffer(buffer, delimiter) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(delimiter, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + delimiter.length;
    index = buffer.indexOf(delimiter, start);
  }
  parts.push(buffer.subarray(start));
  return parts;
}

function parseDisposition(value) {
  const result = {};
  for (const part of value.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawValue.length) continue;
    result[rawKey] = rawValue.join("=").replace(/^"|"$/g, "");
  }
  return result;
}

export async function readRequestBody(request, maxBytes = 20 * 1024 * 1024) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error("File upload is too large.");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    throw new Error("Missing multipart boundary.");
  }

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const rawParts = splitBuffer(buffer, boundary).slice(1, -1);
  const fields = {};
  const files = {};

  for (const rawPart of rawParts) {
    let part = rawPart;
    if (part.subarray(0, 2).toString() === "\r\n") part = part.subarray(2);
    if (part.subarray(-2).toString() === "\r\n") part = part.subarray(0, -2);

    const separator = Buffer.from("\r\n\r\n");
    const separatorIndex = part.indexOf(separator);
    if (separatorIndex === -1) continue;

    const headerText = part.subarray(0, separatorIndex).toString("utf8");
    const body = part.subarray(separatorIndex + separator.length);
    const headers = Object.fromEntries(
      headerText.split("\r\n").map((line) => {
        const [key, ...value] = line.split(":");
        return [key.toLowerCase(), value.join(":").trim()];
      })
    );

    const disposition = parseDisposition(headers["content-disposition"] ?? "");
    if (!disposition.name) continue;

    if (disposition.filename) {
      files[disposition.name] = {
        filename: disposition.filename,
        contentType: headers["content-type"] ?? "application/octet-stream",
        buffer: body
      };
    } else {
      fields[disposition.name] = body.toString("utf8");
    }
  }

  return { fields, files };
}
