package com.eamventures.amwemari.security

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

object CyberApi {
    private const val BASE = "https://eevexpjcyadcjjziwesb.supabase.co"
    private const val API_KEY = "sb_publishable_oAByqcmvRE7fQY5PObAFLw_k5vMPf64"

    fun signIn(email: String, password: String): JSONObject =
        request("/auth/v1/token?grant_type=password", null,
            JSONObject().put("email", email).put("password", password))

    fun refresh(refreshToken: String): JSONObject =
        request("/auth/v1/token?grant_type=refresh_token", null,
            JSONObject().put("refresh_token", refreshToken))

    fun cyber(accessToken: String, body: JSONObject): JSONObject =
        request("/functions/v1/amwemari-cyber-admin", accessToken, body)

    fun signOut(accessToken: String) {
        request("/auth/v1/logout", accessToken, JSONObject())
    }

    private fun request(path: String, bearer: String?, body: JSONObject): JSONObject {
        val connection = (URL(BASE + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15000
            readTimeout = 20000
            doOutput = true
            setRequestProperty("apikey", API_KEY)
            setRequestProperty("Content-Type", "application/json")
            if (!bearer.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $bearer")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val result = try { JSONObject(text) } catch (_: Exception) { JSONObject() }
            if (code !in 200..299) {
                val message = result.optString("msg").ifBlank {
                    result.optString("message").ifBlank { result.optString("error").ifBlank { "HTTP $code" } }
                }
                throw IOException(message)
            }
            return result
        } finally {
            connection.disconnect()
        }
    }
}
