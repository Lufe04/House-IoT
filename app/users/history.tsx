import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, storage, auth } from '@/utils/FirebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

interface Entry {
  id: string;
  imageUrl: string;
  description: string;
  addedBy: string;
  timestamp: Date;
  success: boolean | null;
}

export default function HistoryScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModal] = useState(false);
  const [imageUri, setImageUri] = useState<string>('');
  const [desc, setDesc] = useState('');
  const [uploading, setUploading] = useState(false);

  const { userData } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const q = query(collection(db, 'entries'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, snap => {
      const arr = snap.docs.map(d => ({
        id: d.id,
        imageUrl: d.data().imageUrl,
        description: d.data().description || '',
        addedBy: d.data().addedBy || 'Desconocido',
        success: d.data().success ?? null,
        timestamp: d.data().timestamp?.toDate?.() ?? new Date(),
      }));
      setEntries(arr);
      setLoading(false);
    });
    return unsub;
  }, []);

  /* ---------- picker ---------- */
  const pickPhotoLocal = async () => {
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
    if (!res.canceled && res.assets?.length) setImageUri(res.assets[0].uri);
  };

  /* ---------- save manual ---------- */
  const saveEvent = async () => {
    if (!imageUri) return Alert.alert('Error', 'Selecciona una imagen');
    if (!desc.trim()) return Alert.alert('Error', 'Añade una descripción');

    setUploading(true);
    try {
      const uid = auth.currentUser?.uid ?? 'anon';
      const fileRef = ref(storage, `manual-events/${uid}_${Date.now()}.jpg`);
      const resp = await fetch(imageUri);
      await uploadBytes(fileRef, await resp.blob());
      const url = await getDownloadURL(fileRef);

      const addedBy =
        userData
          ? `${userData.nombre} ${userData.apellido}`.trim()
          : auth.currentUser?.displayName || auth.currentUser?.email || 'Desconocido';

      await addDoc(collection(db, 'entries'), {
        imageUrl: url,
        description: desc.trim(),
        addedBy,
        success: null,
        timestamp: Timestamp.now(),
      });

      setImageUri(''); setDesc(''); setModal(false);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el evento');
    } finally { setUploading(false); }
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0D47A1', '#42A5F5']} style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0D47A1', '#42A5F5']} style={styles.container}>
      <Ionicons
        name="chevron-back"
        size={28}
        color="#fff"
        style={styles.back}
        onPress={() => router.back()}
      />
      <Text style={styles.title}>Historial de Eventos</Text>

      <TouchableOpacity style={styles.addBtn} onPress={() => setModal(true)}>
        <Ionicons name="add" size={28} color="#fff" />
        <Text style={styles.addTxt}>Añadir evento</Text>
      </TouchableOpacity>

      <FlatList
        data={entries}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.imageUrl }} style={styles.photo} />
            <View style={styles.info}>
              <Text style={styles.date}>{item.timestamp.toLocaleString()}</Text>
              <Text style={styles.user}>Por: {item.addedBy}</Text>
              <Text
                style={[
                  styles.status,
                  { color:
                      item.success === null
                        ? '#FFA726'
                        : item.success
                        ? '#4CAF50'
                        : '#F44336' },
                ]}
              >
                {item.success === null
                  ? item.description
                  : item.success
                  ? 'PIN correcto'
                  : 'PIN incorrecto'}
              </Text>
            </View>
          </View>
        )}
      />

      {/* modal */}
      <Modal transparent visible={modalVisible} animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo evento</Text>

            <TouchableOpacity style={styles.pickBtn} onPress={pickPhotoLocal}>
              {imageUri
                ? <Image source={{ uri: imageUri }} style={styles.pickPreview} />
                : <Ionicons name="camera" size={32} color="#666" />}
            </TouchableOpacity>

            <TextInput
              style={styles.descInput}
              placeholder="Descripción del evento"
              placeholderTextColor="#666"
              value={desc}
              onChangeText={setDesc}
            />

            <View style={styles.modalRow}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setModal(false); setImageUri(''); setDesc(''); }}
              >
                <Text style={styles.modalCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={saveEvent}
                disabled={uploading}
              >
                <Text style={styles.modalSaveTxt}>
                  {uploading ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

/* estilos con colores de home */
const styles = StyleSheet.create({
  container:{ flex:1 },
  center:{ flex:1, justifyContent:'center', alignItems:'center' },
  back:{ marginTop:50, marginLeft:16 },
  title:{ color:'#fff', fontSize:22, fontWeight:'600', textAlign:'center', marginVertical:10 },
  addBtn:{ flexDirection:'row', alignItems:'center', alignSelf:'center', marginBottom:8 },
  addTxt:{ color:'#fff', marginLeft:4 },
  card:{
    backgroundColor:'rgba(255,255,255,0.1)',
    borderRadius:12,
    flexDirection:'row',
    marginBottom:12,
    overflow:'hidden',
  },
  photo:{ width:80, height:80 },
  info:{ flex:1, padding:10, justifyContent:'center' },
  date:{ color:'#fff', fontSize:13 },
  user:{ color:'#fff', fontSize:13, marginTop:2 },
  status:{ fontSize:15, fontWeight:'600', marginTop:2 },
  /* modal */
  overlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center' },
  modalCard:{ width:'85%', backgroundColor:'#fff', borderRadius:12, padding:20 },
  modalTitle:{ fontSize:18, fontWeight:'600', marginBottom:12, textAlign:'center' },
  pickBtn:{ width:100, height:100, borderRadius:12, borderWidth:1, borderColor:'#ccc', alignSelf:'center', justifyContent:'center', alignItems:'center', marginBottom:16, overflow:'hidden' },
  pickPreview:{ width:'100%', height:'100%' },
  descInput:{ borderWidth:1, borderColor:'#ccc', borderRadius:8, padding:8, marginBottom:16 },
  modalRow:{ flexDirection:'row', justifyContent:'flex-end' },
  modalCancel:{ padding:10, marginRight:8 },
  modalCancelTxt:{ color:'#666' },
  modalSave:{ padding:10 },
  modalSaveTxt:{ color:'#1565C0', fontWeight:'600' },
});
