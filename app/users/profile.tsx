// app/users/profile.tsx
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '@/context/AuthContext';
import { auth, db, storage } from '@/utils/FirebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile, signOut } from 'firebase/auth';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = 140;

export default function UserProfile() {
  const { currentUser, userData, updateUserData } = useAuth();
  const router = useRouter();

  const fallbackName = `${userData?.nombre || ''} ${userData?.apellido || ''}`.trim() ||
                       currentUser?.displayName ||
                       'Usuario';
  const fallbackPhoto =
    currentUser?.photoURL ||
    'https://firebasestorage.googleapis.com/v0/b/house-iot-e4af8.appspot.com/o/avatars%2Funknown.jpg?alt=media';

  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState(fallbackName);
  const [bio, setBio]           = useState('');
  const [photoURL, setPhotoURL] = useState(fallbackPhoto);

  /* ── cargar bio inicial ── */
  useEffect(() => {
    (async () => {
      if (!currentUser) return;
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        setBio(data.bio || '');
        if (data.photoURL) setPhotoURL(data.photoURL);
      }
    })();
  }, []);

  /* ── seleccionar/capturar foto ── */
  const changePhoto = async () => {
    const { status: libStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: camStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    if (libStatus !== 'granted' || camStatus !== 'granted') {
      Alert.alert('Permiso denegado', 'Se requieren permisos de cámara y galería.');
      return;
    }

    Alert.alert('Seleccionar imagen', '¿De dónde deseas obtener la foto?', [
      { text: 'Cámara',  onPress: () => pick('camera') },
      { text: 'Galería', onPress: () => pick('gallery') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const pick = async (src: 'camera' | 'gallery') => {
    const res =
      src === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
          });

    if (!res.canceled && res.assets?.length && currentUser) {
      try {
        const uri = res.assets[0].uri;
        const fileRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}.jpg`);
        const resp = await fetch(uri);
        await uploadBytes(fileRef, await resp.blob());
        const downloadURL = await getDownloadURL(fileRef);

        /* Auth profile */
        await updateProfile(currentUser, { photoURL: downloadURL });
        /* Firestore */
        await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: downloadURL });
        /* Local */
        setPhotoURL(downloadURL);
      } catch {
        Alert.alert('Error', 'No se pudo actualizar la imagen.');
      }
    }
  };

  /* ── guardar cambios ── */
  const handleSave = async () => {
    if (!currentUser) return;
    try {
      /* Auth displayName */
      await updateProfile(currentUser, { displayName: name });
      /* Firestore */
      await updateDoc(doc(db, 'users', currentUser.uid), {
        nombre: name.split(' ')[0] || '',
        apellido: name.split(' ').slice(1).join(' ') || '',
        bio,
      });
      /* Context */
      await updateUserData({ nombre: name.split(' ')[0], apellido: name.split(' ').slice(1).join(' '), });
      Alert.alert('Guardado', 'Perfil actualizado');
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  /* ── logout ── */
  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/auth');
  };

  /* ── UI ── */
  return (
    <LinearGradient colors={['#0D47A1', '#42A5F5']} style={styles.safe}>
      {/* modal edición */}
      <Modal transparent visible={editing} animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar perfil</Text>
            <Text style={styles.modalLabel}>Nombre completo</Text>
            <TextInput
              style={styles.modalInput}
              value={name}
              onChangeText={setName}
              placeholder="Nombre completo"
            />
            <Text style={styles.modalLabel}>Descripción</Text>
            <TextInput
              style={[styles.modalInput, { height: 100 }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Cuéntanos algo de ti"
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <LinearGradient
                  colors={['#5A40EA', '#EE805F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveGradient}
                >
                  <Text style={styles.saveText}>Guardar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SafeAreaView style={{ flex:1 }}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <LinearGradient
            colors={['#5A40EA', '#EE805F']}
            style={styles.avatarWrapper}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <TouchableOpacity style={styles.avatarInner} onPress={changePhoto}>
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            </TouchableOpacity>
          </LinearGradient>

          {/* Nombre, rol, bio */}
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.role}>{userData?.role?.toUpperCase() || 'ROL'}</Text>
          <Text style={styles.description}>{bio || 'Sin descripción'}</Text>

          {/* Acciones */}
          <View style={styles.actionsRow}>
            <View style={styles.actionItemCenter}>
              <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
                <MaterialCommunityIcons name="pencil-outline" size={32} color="#000" />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>EDITAR</Text>
            </View>

            <View style={styles.actionItemCenter}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={32} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.actionLabelWhite}>SALIR</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ── estilos ── */
const styles = StyleSheet.create({
  safe:{ flex:1 },
  container:{
    alignItems:'center',
    paddingTop: Platform.OS==='ios'?20:10,
    paddingBottom:30,
    paddingHorizontal:20,
  },
  avatarWrapper:{
    alignItems:'center',
    justifyContent:'center',
    marginBottom:16,
    padding:4,
    borderRadius:(AVATAR_SIZE+16)/2+4,
  },
  avatarInner:{
    width:AVATAR_SIZE+16,
    height:AVATAR_SIZE+16,
    borderRadius:(AVATAR_SIZE+16)/2,
    backgroundColor:'#FFF',
    alignItems:'center',
    justifyContent:'center',
  },
  avatar:{ width:AVATAR_SIZE, height:AVATAR_SIZE, borderRadius:AVATAR_SIZE/2 },
  name:{ fontSize:22, fontWeight:'600', color:'#FFF', marginTop:8 },
  role:{ fontSize:14, color:'#BBDEFB', marginTop:2 },
  description:{ fontSize:16, color:'#FFF', textAlign:'center', marginVertical:24, paddingHorizontal:10 },
  actionsRow:{ flexDirection:'row', width:'100%', justifyContent:'space-evenly', marginTop:10 },
  actionItemCenter:{ alignItems:'center' },
  actionLabel:{ fontSize:12, color:'#000', marginTop:6 },
  actionLabelWhite:{ fontSize:12, color:'#FFF', marginTop:6 },
  editButton:{
    backgroundColor:'#FFF', width:64, height:64,
    borderRadius:32, justifyContent:'center', alignItems:'center', elevation:4,
  },
  logoutButton:{
    backgroundColor:'#F44336', width:64, height:64,
    borderRadius:32, justifyContent:'center', alignItems:'center',
  },

  /* modal */
  overlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
  modalContent:{ width:'90%', backgroundColor:'#FFF', borderRadius:12, padding:20 },
  modalTitle:{ fontSize:18, fontWeight:'600', marginBottom:12, textAlign:'center' },
  modalLabel:{ fontSize:14, color:'#666', marginTop:8 },
  modalInput:{ borderWidth:1, borderColor:'#DDD', borderRadius:8, padding:8, marginTop:4 },
  modalActions:{ flexDirection:'row', justifyContent:'flex-end', alignItems:'center', marginTop:16 },
  cancelButton:{ paddingHorizontal:16, height:40, justifyContent:'center', alignItems:'center', marginRight:8 },
  cancelText:{ color:'#666', fontSize:14, fontWeight:'600' },
  saveButton:{ overflow:'hidden', borderRadius:6 },
  saveGradient:{ paddingHorizontal:16, paddingVertical:8, borderRadius:6, alignItems:'center' },
  saveText:{ color:'#FFF', fontSize:14 },
});
