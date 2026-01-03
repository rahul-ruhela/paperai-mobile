import * as ImagePicker from "expo-image-picker";
import * as Camera from "expo-camera";

export async function requestPhotoPermissions() {
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!media.granted) {
        throw new Error("Photo library permission not granted");
    }
}

export async function requestCameraPermissions() {
    const camera = await Camera.requestCameraPermissionsAsync();
    if (!camera.granted) {
        throw new Error("Camera permission not granted");
    }
}
