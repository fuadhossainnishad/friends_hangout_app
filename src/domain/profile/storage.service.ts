/**
 * storage.service.ts
 */
import { Platform } from 'react-native';
import storage from '@react-native-firebase/storage';

/**
 * Strips the file:// prefix that react-native-image-picker adds.
 * putFile() on Android requires a bare file system path — not a URI.
 * iOS accepts both, but stripping is safe on both platforms.
 */
function toFilePath(uri: string): string {
    return Platform.OS === 'android' ? uri.replace('file://', '') : uri;
}

/**
 * Uploads a local image URI to Firebase Storage.
 * Returns the permanent public download URL once complete.
 *
 * Wraps the Task in an explicit Promise so the progress listener
 * is attached synchronously before the upload begins — preventing
 * any state_changed events being missed on fast connections.
 */
export function uploadFile(
    localUri: string,
    storagePath: string,
    onProgress?: (percent: number) => void
): Promise<string> {
    return new Promise((resolve, reject) => {
        const filePath = toFilePath(localUri);
        const ref = storage().ref(storagePath);
        const task = ref.putFile(filePath);

        task.on(
            'state_changed',
            snapshot => {
                if (onProgress && snapshot.totalBytes > 0) {
                    const percent = Math.round(
                        (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    );
                    onProgress(percent);
                }
            },
            error => reject(error),
            async () => {
                try {
                    const url = await ref.getDownloadURL();
                    resolve(url);
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}

/**
 * Deletes a file by storage path.
 * Safe to call if the file doesn't exist — failure is silently swallowed.
 */
export async function deleteFile(storagePath: string): Promise<void> {
    try {
        await storage().ref(storagePath).delete();
    } catch {
        // Not fatal
    }
}