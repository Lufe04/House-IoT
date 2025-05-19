// app/auth/register.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

import { auth, db, storage } from '@/utils/FirebaseConfig';
import { UserRole } from '@/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

/* -------------------------------------------------------------------------- */
/*  Colores igual que en home.tsx                                             */
const COLORS = {
  blueDark : '#0D47A1',
  blueLight: '#42A5F5',
  gray     : '#989898',
  white    : '#FFFFFF',
};

/*  Clave familiar para padres / madres                                       */
const FAMILY_KEY = '12345';

/*  Avatar por defecto si el usuario no sube foto                             */
const DEFAULT_AVATAR =
  'https://firebasestorage.googleapis.com/v0/b/house-iot-e4af8.appspot.com/o/avatars%2Funknown.jpg?alt=media';
/* -------------------------------------------------------------------------- */

export default function Register() {
  /* ---------------- estados de formulario ---------------- */
  const [name, setName]               = useState('');
  const [lastName, setLastName]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [showPassword, setShowPw]     = useState(false);
  const [showConfirm, setShowCp]      = useState(false);

  const [userRole, setUserRole]       = useState<UserRole>('child');
  const [familyKey, setFamilyKey]     = useState('');

  const [photoUri, setPhotoUri]       = useState<string>('');
  const [uploading, setUploading]     = useState(false);

  const router = useRouter();

  /* ---------------- escoger foto (cámara o galería) ---------------- */
  const pickPhoto = async () => {
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

  const pick = async (source: 'camera' | 'gallery') => {
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
          });
    if (!result.canceled && result.assets?.length) setPhotoUri(result.assets[0].uri);
  };

  /* ---------------- registro ---------------- */
  const handleRegister = async () => {
    if (!name || !lastName || !email || !password || !confirmPassword)
      return Alert.alert('Error', 'Por favor, completa todos los campos');

    if (password !== confirmPassword)
      return Alert.alert('Error', 'Las contraseñas no coinciden');

    if (password.length < 6)
      return Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return Alert.alert('Error', 'Correo electrónico inválido');

    if ((userRole === 'father' || userRole === 'mother') && familyKey !== FAMILY_KEY)
      return Alert.alert('Error', 'La clave de familia no es válida');

    setUploading(true);
    try {
      /* create user */
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      let avatarURL = DEFAULT_AVATAR;

      /* subir foto si existe */
      if (photoUri) {
        const fileRef = ref(storage, `avatars/${cred.user.uid}_${Date.now()}.jpg`);
        const resp = await fetch(photoUri);
        await uploadBytes(fileRef, await resp.blob());
        avatarURL = await getDownloadURL(fileRef);
      }

      /* actualizar perfil */
      await updateProfile(cred.user, {
        displayName: name.trim(),
        photoURL: avatarURL,
      });

      /* guardar en Firestore */
      await setDoc(doc(db, 'users', cred.user.uid), {
        nombre: name.trim(),
        apellido: lastName.trim(),
        correo: email.trim(),
        role: userRole,
        photoURL: avatarURL,
        createdAt: Timestamp.now(),
      });

      Alert.alert('Éxito', '¡Cuenta creada exitosamente!', [
        { text: 'OK', onPress: () => router.replace('../users') },
      ]);
    } catch (e: any) {
      let msg = 'Error al crear la cuenta';
      if (e.code === 'auth/email-already-in-use') msg = 'Este correo ya está en uso';
      if (e.code === 'auth/invalid-email')        msg = 'Correo electrónico inválido';
      if (e.code === 'auth/weak-password')        msg = 'La contraseña es muy débil';
      Alert.alert('Error', msg);
    } finally { setUploading(false); }
  };

  const navigateToLogin = () => router.push('/auth');

  /* ---------------- UI ---------------- */
  return (
    <LinearGradient colors={[COLORS.blueDark, COLORS.blueLight]} style={{ flex:1 }}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Stack.Screen options={{ headerShown: false }} />

          {/* header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Sign Up</Text>
          </View>

          {/* formulario */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Crea tu cuenta para controlar la casa</Text>

            {/* nombre */}
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nombre"
                placeholderTextColor={COLORS.gray}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {/* apellido */}
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Apellido"
                placeholderTextColor={COLORS.gray}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>

            {/* email */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Correo"
                placeholderTextColor={COLORS.gray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* contraseña */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Contraseña"
                placeholderTextColor={COLORS.gray}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPw(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>

            {/* confirmar */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirma contraseña"
                placeholderTextColor={COLORS.gray}
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirm}
              />
              <TouchableOpacity onPress={() => setShowCp(!showConfirm)} style={styles.eyeIcon}>
                <Ionicons name={showConfirm ? 'eye-outline' : 'eye-off-outline'} size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>

            {/* foto perfil */}
            <Text style={styles.sectionLabel}>Foto de perfil (opcional):</Text>
            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                {photoUri
                  ? <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  : <Ionicons name="camera" size={28} color={COLORS.gray} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPhotoUri('')}>
                <Text style={styles.skipText}>{photoUri ? 'Quitar' : 'Omitir'}</Text>
              </TouchableOpacity>
            </View>

            {/* rol */}
            <Text style={styles.sectionLabel}>Tipo de cuenta:</Text>
            <View style={styles.roleContainer}>
              {['child','father','mother'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={styles.roleOption}
                  onPress={() => setUserRole(r as UserRole)}
                >
                  <View style={styles.radioContainer}>
                    <View style={[
                      styles.radioOuter,
                      userRole === r && { borderColor: COLORS.blueLight },
                    ]}>
                      {userRole === r && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.roleText}>
                      {r === 'child' ? 'Hijo / Hija' : r === 'father' ? 'Papá' : 'Mamá'}
                    </Text>
                  </View>
                  <Text style={styles.roleDescription}>
                    {r === 'child'
                      ? 'Acceso limitado: solo luces y persianas'
                      : r === 'father'
                      ? 'Control total de la casa'
                      : 'Todo menos la alarma'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* clave familia */}
            {(userRole === 'father' || userRole === 'mother') && (
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Clave de familia"
                  placeholderTextColor={COLORS.gray}
                  secureTextEntry
                  value={familyKey}
                  onChangeText={setFamilyKey}
                />
              </View>
            )}

            {/* botón registro */}
            <TouchableOpacity
              style={styles.registerButton}
              onPress={handleRegister}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.registerButtonText}>Sign Up</Text>}
            </TouchableOpacity>

            {/* login link */}
            <View style={styles.loginAccountContainer}>
              <Text style={styles.haveAccountText}>¿Ya tienes cuenta? </Text>
              <TouchableOpacity onPress={navigateToLogin}>
                <Text style={styles.loginAccountText}>Login</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ---------------- estilos ---------------- */
const styles = StyleSheet.create({
  container:{ flex:1 },
  keyboardView:{ flex:1 },
  header:{ flexDirection:'row', alignItems:'center', paddingTop: Platform.OS==='android'?40:10, paddingBottom:15, paddingHorizontal:20 },
  backButton:{ width:40, height:40, borderRadius:20, justifyContent:'center', alignItems:'center', marginRight:10 },
  headerTitle:{ color:COLORS.white, fontSize:20, fontWeight:'600' },

  content:{ flex:1, padding:20, backgroundColor:'rgba(255,255,255,0.15)', borderTopLeftRadius:30, borderTopRightRadius:30, marginTop:-20 },
  title:{ fontSize:24, fontWeight:'bold', color:COLORS.white, marginTop:20, marginBottom:30 },

  inputContainer:{ flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:'#E0E0E0', borderRadius:30, paddingHorizontal:15, marginBottom:15, height:55, backgroundColor:COLORS.white },
  inputIcon:{ marginRight:10 },
  input:{ flex:1, height:'100%', fontSize:16, color:COLORS.blueDark },
  eyeIcon:{ padding:8 },

  sectionLabel:{ fontSize:16, fontWeight:'600', color:COLORS.white, marginBottom:10 },
  photoRow:{ flexDirection:'row', alignItems:'center', marginBottom:20 },
  photoBtn:{ width:80, height:80, borderRadius:40, borderWidth:2, borderColor:'#BBDEFB', justifyContent:'center', alignItems:'center', overflow:'hidden', marginRight:12 },
  photoPreview:{ width:'100%', height:'100%' },
  skipText:{ color:COLORS.gray, textDecorationLine:'underline' },

  roleContainer:{ marginBottom:20 },
  roleOption:{ borderWidth:1, borderColor:'#E0E0E0', borderRadius:10, padding:15, marginBottom:10, backgroundColor:'rgba(255,255,255,0.15)' },
  radioContainer:{ flexDirection:'row', alignItems:'center', marginBottom:5 },
  radioOuter:{ height:20, width:20, borderRadius:10, borderWidth:2, borderColor:COLORS.gray, alignItems:'center', justifyContent:'center', marginRight:10, backgroundColor:COLORS.white },
  radioInner:{ height:10, width:10, borderRadius:5, backgroundColor:COLORS.blueLight },
  roleText:{ fontSize:16, fontWeight:'600', color:COLORS.white },
  roleDescription:{ fontSize:14, color:COLORS.white, marginLeft:30 },

  registerButton:{ backgroundColor:'rgba(255,255,255,0.2)', borderRadius:30, height:55, justifyContent:'center', alignItems:'center', marginBottom:25 },
  registerButtonText:{ color:COLORS.white, fontSize:16, fontWeight:'bold' },

  loginAccountContainer:{ flexDirection:'row', justifyContent:'center', marginTop:10, marginBottom:20 },
  haveAccountText:{ color:COLORS.white, fontSize:14 },
  loginAccountText:{ color:'#BBDEFB', fontSize:14, fontWeight:'600' },
});
