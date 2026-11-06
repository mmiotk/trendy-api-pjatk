import type { PackageDefinition } from "@grpc/proto-loader";
import descriptor, { type IFileDescriptorProto } from "protobufjs/ext/descriptor/index.js";

// proto-loader nie zapisuje importów w opisach plików, a grpcurl bez nich nie złoży typu z innego pakietu.
// Funkcja dopisuje plikowi `file` zależność od pliku `imported` (nazwy plików tworzy proto-loader z nazw pakietów).
export function addImport(definition: PackageDefinition, file: string, imported: string): void {
  for (const entry of Object.values(definition)) {
    const protos = (entry as { fileDescriptorProtos?: Uint8Array[] }).fileDescriptorProtos;
    protos?.forEach((bytes, i) => {
      const proto = descriptor.FileDescriptorProto.decode(bytes) as IFileDescriptorProto;
      if (proto.name === file && !proto.dependency.includes(imported)) {
        proto.dependency.push(imported);
        protos[i] = descriptor.FileDescriptorProto.encode(proto).finish();
      }
    });
  }
}
