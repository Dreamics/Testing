import React, { useRef, useState, useLayoutEffect } from 'react';
import { View, TextInput, Image, TouchableOpacity, Alert, Keyboard, useColorScheme, ActivityIndicator, StyleSheet, Dimensions, Platform, TouchableWithoutFeedback, Text } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { KeyboardStickyView, KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as FileSystem from 'expo-file-system';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { supabase } from '../utils/subabase';
import { useRouter, useNavigation } from 'expo-router';  
import * as Haptics from 'expo-haptics';



const { width } = Dimensions.get('window');
const totalPages = 4;
const GAP = 5;
const innerWidth = width - 2 * GAP;
const segmentFullWidth = (innerWidth - GAP * (totalPages - 1)) / totalPages;

interface PageScrollEvent {
  nativeEvent: {
    position: number;
    offset: number;
  };
}

interface ProgressSegmentProps {
  index: number;
  pageProgress: any;
}

const SignupScreen = () => {
  const pagerRef = useRef<PagerView>(null);
  const navigation = useNavigation(); 
  const router = useRouter(); 
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const pageProgress = useSharedValue(0);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);


  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss(); 
            if (currentPage > 0) {
              const previousPage = currentPage - 1;
              pagerRef.current?.setPage(previousPage);
              setCurrentPage(previousPage);
            } else {
              navigation.goBack();
            }
          }}
          style={{ marginLeft: 10 }}
        >
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, currentPage]);

  const onPageScroll = (e: PageScrollEvent): void => {
    const { position, offset } = e.nativeEvent;
    pageProgress.value = position + offset;
  };

  const handleNextOrSubmit = () => {
    Haptics.selectionAsync();
    
    if (currentPage < totalPages - 1) {
      const nextPage = currentPage + 1;
      pagerRef.current?.setPage(nextPage); 
    } else {
      handleSubmit();
    }
  };
  const isButtonDisabled = () => {
    if (currentPage === 0 && !phone.trim()) return true;
    if (currentPage === 1 && !name.trim()) return true;
    if (currentPage === 2 && !username.trim()) return true;
    return false;
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to the media library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        Alert.alert('Error', 'You must be logged in to complete registration');
        return;
      }

      let profilePhotoUrl = null;
      if (profilePhoto) {
        const fileName = profilePhoto.split('/').pop()!;
        const fileExt = fileName.split('.').pop();
        const fileData = await FileSystem.readAsStringAsync(profilePhoto, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { data, error } = await supabase.storage
          .from('user-images')
          .upload(`${user.id}/${Date.now()}.${fileExt}`, fileData, {
            contentType: `image/${fileExt}`,
          });
        if (error) throw error;

        const { data: publicUrlData } = supabase.storage
          .from('user-images')
          .getPublicUrl(data.path);
        profilePhotoUrl = publicUrlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          phone: phone,
          full_name: name,
          username: username,
          profile_photo: profilePhotoUrl,
          updated_at: new Date().toISOString(),
        });
      if (updateError) throw updateError;

      Alert.alert('Success', 'Registration Complete!');
      router.push('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Submission Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={"padding"}
      keyboardVerticalOffset={100}
      style={styles.content}
    >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ThemedView style={styles.container}>
          <ThemedView style={styles.storiesProgressContainer}>
            {Array.from({ length: totalPages }, (_, index) => (
              <ProgressSegment key={index} index={index} pageProgress={pageProgress} />
            ))}
          </ThemedView>

          <PagerView
            style={styles.pagerView}
            initialPage={0}
            scrollEnabled={false}
            onPageScroll={onPageScroll}
            onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
            ref={pagerRef}
          >
            {/* Page 1: Mobile Number */}

            <View key="1" style={styles.page}>
              <ThemedText style={styles.title}>Your Mobile Number</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholderTextColor={colors.icon}
                placeholder="Enter your mobile number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>


            {/* Page 2: Name */}
            <View key="2" style={styles.page}>
              <ThemedText style={styles.title}>What's your name?</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholderTextColor={colors.icon}
                placeholder="Enter your full name"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Page 3: Username */}
            <View key="3" style={styles.page}>
              <ThemedText style={styles.title}>Choose a Username</ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholderTextColor={colors.icon}
                placeholder="Enter a username"
                value={username}
                onChangeText={setUsername}
              />
            </View>

            {/* Page 4: Profile Photo (Optional) */}
            <View key="4" style={styles.page}>
              <ThemedText style={styles.title}>Upload a Profile Photo (Optional)</ThemedText>
              <TouchableOpacity
                style={[styles.uploadButton, { backgroundColor: colors.tint + '20' }]}
                onPress={pickImage}
                disabled={loading}
              >
                <ThemedText style={{ color: colors.tint }}>Choose Photo</ThemedText>
              </TouchableOpacity>
              {profilePhoto && (
                <Image source={{ uri: profilePhoto }} style={[styles.image, { borderColor: colors.border }]} />
              )}
            </View>
          </PagerView>


            <AnimatedButton
              title={currentPage < totalPages - 1 ? 'Next' : 'Submit'}
              onPress={handleNextOrSubmit}
              disabled={isButtonDisabled() || loading}
              colors={colors}
              loading={loading}
            />
        </ThemedView>
    </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  

  );
};

const AnimatedButton = ({ title, onPress, disabled, colors, loading }: any) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, { width: '100%' }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.button,
          { backgroundColor: colors.tint },
          (disabled || loading) && { opacity: 0.5 },
        ]}
        onPressIn={() => {
          scale.value = withTiming(0.95, { duration: 100 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 100 });
        }}
        onPress={onPress}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <ThemedText style={[styles.buttonText, { color: colors.background }]}>{title}</ThemedText>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const ProgressSegment = ({ index, pageProgress }: ProgressSegmentProps) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const animatedStyle = useAnimatedStyle(() => ({
    width: Math.min(Math.max(pageProgress.value - index, 0), 1) * segmentFullWidth,
  }));

  return (
    <View
      style={[
        styles.segmentContainer,
        {
          width: segmentFullWidth,
          marginRight: index !== totalPages - 1 ? GAP : 0,
          backgroundColor: colors.inputBg,
        },
      ]}
    >
      <Animated.View style={[styles.segmentFill, { backgroundColor: colors.tint }, animatedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
     
  storiesProgressContainer: {
    flexDirection: 'row',
    padding: GAP,
    paddingBottom: 10,
  },
  segmentContainer: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 30,
    fontWeight: '600',
  },
  input: {
    width: '80%',
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 30,
  },
  uploadButton: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
  },
  button: {
    padding: 22,
    borderRadius: 360,
    width: '90%',
    position: 'absolute',
    bottom: 20,
    alignItems: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    fontWeight: '500',
  },

  headerButtonText: {
    fontSize: 16,
    color: '#007aff',
  },
});

export default SignupScreen;

