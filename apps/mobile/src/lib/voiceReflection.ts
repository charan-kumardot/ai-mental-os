import * as FileSystem from 'expo-file-system/legacy';
import { functions } from './appwrite';

export interface VoiceProcessResult {
  flagged?: boolean;
  response?: string;
  transcript?: string;
  intent?: string;
  event?: string | null;
  emotion?: string | null;
  concern?: string | null;
  error?: string;
}

export async function processVoiceRecording(fileUri: string): Promise<VoiceProcessResult> {
  const audioBase64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
  const execution = await functions.createExecution({
    functionId: 'process-mental-inbox',
    body: JSON.stringify({ action: 'voice_reflection', audioBase64, mimeType: 'audio/m4a' }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}

export async function saveVoiceReflection(data: {
  transcript: string;
  intent?: string;
  event?: string | null;
  emotion?: string | null;
  concern?: string | null;
}) {
  const execution = await functions.createExecution({
    functionId: 'process-mental-inbox',
    body: JSON.stringify({ action: 'save_voice_reflection', ...data }),
    async: false,
  });
  return JSON.parse(execution.responseBody || '{}');
}
