package com.eamventures.amwemari.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import java.util.UUID

class SecureVault(context: Context) {
    private val prefs = context.getSharedPreferences("amwemari_cyber_vault", Context.MODE_PRIVATE)
    private val alias = "amwemari_cyber_vault_key"

    @Synchronized
    fun get(name: String): String? = readAll().optString(name).takeIf { it.isNotBlank() }

    @Synchronized
    fun put(name: String, value: String) {
        val data = readAll()
        data.put(name, value)
        writeAll(data)
    }

    @Synchronized
    fun remove(vararg names: String) {
        val data = readAll()
        names.forEach { data.remove(it) }
        writeAll(data)
    }

    fun deviceKey(): String {
        val existing = get("device_key")
        if (existing != null) return existing
        val created = "android-" + UUID.randomUUID().toString()
        put("device_key", created)
        return created
    }

    fun rotateDeviceKey(): String {
        val created = "android-" + UUID.randomUUID().toString()
        put("device_key", created)
        remove("device_secret", "device_id")
        return created
    }

    fun saveSession(access: String, refresh: String, expiresIn: Long, email: String) {
        put("access_token", access)
        put("refresh_token", refresh)
        put("expires_at", (System.currentTimeMillis() / 1000L + expiresIn).toString())
        put("admin_email", email)
    }

    fun clearSession() {
        remove("access_token", "refresh_token", "expires_at", "admin_email")
    }

    private fun readAll(): JSONObject {
        val packed = prefs.getString("payload", null) ?: return JSONObject()
        return try {
            val bytes = Base64.decode(packed, Base64.NO_WRAP)
            val iv = bytes.copyOfRange(0, 12)
            val encrypted = bytes.copyOfRange(12, bytes.size)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, iv))
            JSONObject(String(cipher.doFinal(encrypted), Charsets.UTF_8))
        } catch (_: Exception) {
            JSONObject()
        }
    }

    private fun writeAll(data: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val encrypted = cipher.doFinal(data.toString().toByteArray(Charsets.UTF_8))
        val packed = cipher.iv + encrypted
        prefs.edit().putString("payload", Base64.encodeToString(packed, Base64.NO_WRAP)).apply()
    }

    private fun getOrCreateKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }
}
