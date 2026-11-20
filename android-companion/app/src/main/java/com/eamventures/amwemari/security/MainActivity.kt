package com.eamventures.amwemari.security

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.Gravity
import android.view.ViewGroup
import android.widget.*
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.security.MessageDigest
import java.util.Locale

class MainActivity : Activity() {
 private lateinit var status: TextView
 private lateinit var output: TextView
 private lateinit var link: EditText
 private val channel = "amwemari_critical_security"
 private val maxBytes = 50L * 1024L * 1024L

 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  makeChannel()
  val body = LinearLayout(this).apply {
   orientation = LinearLayout.VERTICAL
   gravity = Gravity.CENTER_HORIZONTAL
   setPadding(18, 22, 18, 22)
  }
  fun addButton(label: String, action: () -> Unit) {
   body.addView(Button(this).apply { text = label; minHeight = 48; setOnClickListener { action() } },
    LinearLayout.LayoutParams(-1, -2))
  }
  body.addView(TextView(this).apply { text = "AMWEMARI SECURITY"; textSize = 23f; gravity = Gravity.CENTER })
  body.addView(TextView(this).apply {
   text = "Chunguza faili ulilochagua, angalia apps zinazoonekana na viashiria vya link."
   textSize = 14f; gravity = Gravity.CENTER; setPadding(0, 12, 0, 12)
  })
  status = TextView(this).apply { text = "Tayari. Hakuna ufuatiliaji wa siri."; setPadding(8, 12, 8, 12) }
  body.addView(status)
  addButton("Chagua faili kwa uchunguzi") {
   startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
    addCategory(Intent.CATEGORY_OPENABLE); type = "*/*"
   }, 45403)
  }
  addButton("Orodhesha apps zinazoonekana") { listVisibleApps() }
  link = EditText(this).apply { hint = "Bandika link hapa (https://...)"; singleLine = true }
  body.addView(link, LinearLayout.LayoutParams(-1, -2))
  addButton("Kagua viashiria vya link") { inspectLink(link.text.toString()) }
  addButton("Ruhusu taarifa za usalama") { requestNotifications() }
  addButton("Jaribu tahadhari (jaribio tu)") { testNotification() }
  output = TextView(this).apply { text = "Matokeo yataonekana hapa."; textSize = 13f; setTextIsSelectable(true); setPadding(8, 18, 8, 20) }
  body.addView(output)
  body.addView(TextView(this).apply {
   text = "Android hairuhusu app hii kusoma mafaili yote au data binafsi za apps nyingine. Uchunguzi wa faili unahusu faili ulilochagua. Matokeo si uthibitisho wa antivirus."
   textSize = 12f
  })
  setContentView(ScrollView(this).apply { addView(body) })
 }

 @Deprecated("Document picker callback")
 override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
  super.onActivityResult(requestCode, resultCode, data)
  if (requestCode == 45403 && resultCode == RESULT_OK) data?.data?.let { scanFile(it) }
 }

 private fun scanFile(uri: Uri) {
  status.text = "Inachunguza faili…"
  Thread {
   try {
    val name = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
     if (it.moveToFirst()) it.getString(0) else null
    } ?: "selected-file"
    val sha = MessageDigest.getInstance("SHA-256")
    val head = ByteArray(8)
    var headSize = 0
    var total = 0L
    contentResolver.openInputStream(uri).use { stream ->
     requireNotNull(stream)
     val buffer = ByteArray(65536)
     while (true) {
      val n = stream.read(buffer); if (n < 0) break
      total += n; require(total <= maxBytes) { "Faili limezidi kikomo cha 50 MB." }
      sha.update(buffer, 0, n)
      if (headSize < head.size) {
       val c = minOf(n, head.size - headSize)
       System.arraycopy(buffer, 0, head, headSize, c); headSize += c
      }
     }
    }
    val sig = signature(head, headSize)
    val ext = name.substringAfterLast('.', "").lowercase(Locale.ROOT)
    val executable = sig in setOf("APK/ZIP", "Windows PE", "Linux ELF", "Java/Dex")
    val mismatch = (sig == "Windows PE" && ext !in setOf("exe","dll","sys")) ||
     (sig == "PDF" && ext != "pdf") || (sig == "PNG" && ext != "png") ||
     (sig == "JPEG" && ext !in setOf("jpg","jpeg"))
    val verdict = if (mismatch) "REVIEW: extension haifanani na signature"
     else if (executable) "REVIEW: executable/package file"
     else "UNVERIFIED: hakuna verdict ya usalama"
    val hash = sha.digest().joinToString("") { "%02x".format(it) }
    runOnUiThread {
     output.text = "FILE: $name\\nSIZE: $total bytes\\nSHA-256: $hash\\nSIGNATURE: $sig\\nRESULT: $verdict\\n\\nHash haijalinganishwa na threat database. Unverified haimaanishi salama."
     status.text = "Uchunguzi umekamilika."
    }
   } catch (e: Exception) {
    runOnUiThread { status.text = "Uchunguzi haujakamilika."; output.text = e.message ?: "Hitilafu." }
   }
  }.start()
 }

 private fun signature(b: ByteArray, n: Int): String {
  fun starts(vararg x: Int) = n >= x.size && x.indices.all { (b[it].toInt() and 255) == x[it] }
  return when {
   starts(0x50,0x4b,0x03,0x04) || starts(0x50,0x4b,0x05,0x06) -> "APK/ZIP"
   starts(0x4d,0x5a) -> "Windows PE"
   starts(0x7f,0x45,0x4c,0x46) -> "Linux ELF"
   starts(0x64,0x65,0x78,0x0a) -> "Java/Dex"
   starts(0x25,0x50,0x44,0x46) -> "PDF"
   starts(0x89,0x50,0x4e,0x47) -> "PNG"
   starts(0xff,0xd8,0xff) -> "JPEG"
   else -> "Unknown"
  }
 }

 private fun listVisibleApps() {
  try {
   val items = packageManager.getInstalledApplications(0).map {
    packageManager.getApplicationLabel(it).toString() + " — " + it.packageName
   }.distinct().sorted()
   output.text = "APPS ZINAZOONEKANA KWA ANDROID (si malware scan):\\n\\n" + items.joinToString("\\n")
   status.text = "Apps zinazoonekana: " + items.size
  } catch (e: Exception) { output.text = e.message ?: "Hitilafu." }
 }

 private fun inspectLink(raw: String) {
  val value = raw.trim()
  if (value.isBlank()) { output.text = "Bandika link kwanza."; return }
  val u = Uri.parse(value)
  val host = u.host?.lowercase(Locale.ROOT)
  val flags = mutableListOf<String>()
  if (u.scheme?.lowercase(Locale.ROOT) != "https") flags.add("HTTPS haipo")
  if (host.isNullOrBlank()) flags.add("Domain haijatambulika")
  if (u.userInfo != null) flags.add("URL ina username/password")
  if (host?.contains("xn--") == true) flags.add("Punycode domain; kagua kwa makini")
  if (u.port != -1 && u.port !in setOf(80,443)) flags.add("Port isiyo ya kawaida")
  output.text = "HOST: " + (host ?: "unknown") + "\\n" +
   (if (flags.isEmpty()) "Hakuna kiashiria rahisi. SI UTHIBITISHO WA USALAMA." else flags.joinToString("\\n"))
   + "\\n\\nHakuna online reputation check iliyofanyika."
  status.text = "Ukaguzi wa awali wa link umekamilika."
 }

 private fun makeChannel() {
  if (Build.VERSION.SDK_INT >= 26) {
   val c = NotificationChannel(channel, "AMWEMARI critical security alerts", NotificationManager.IMPORTANCE_HIGH)
   c.enableVibration(true); c.vibrationPattern = longArrayOf(0,500,250,500,250,900)
   getSystemService(NotificationManager::class.java).createNotificationChannel(c)
  }
 }
 private fun requestNotifications() {
  if (Build.VERSION.SDK_INT >= 33 &&
   checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
   requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 45402)
  } else status.text = "Ruhusa ya notifications ipo."
 }
 private fun testNotification() {
  if (Build.VERSION.SDK_INT >= 33 &&
   checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
   requestNotifications(); return
  }
  val n = NotificationCompat.Builder(this, channel)
   .setSmallIcon(android.R.drawable.ic_dialog_alert)
   .setContentTitle("AMWEMARI — TEST ALERT")
   .setContentText("Jaribio tu; si shambulio lililogunduliwa.")
   .setPriority(NotificationCompat.PRIORITY_MAX).setAutoCancel(true).build()
  try { NotificationManagerCompat.from(this).notify(45401, n); status.text = "Test notification imetumwa." }
  catch (_: SecurityException) { status.text = "Android imezuia notification." }
 }
}
