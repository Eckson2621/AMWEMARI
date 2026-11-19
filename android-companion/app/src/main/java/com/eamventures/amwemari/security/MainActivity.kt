package com.eamventures.amwemari.security

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.view.Gravity
import android.view.ViewGroup
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class MainActivity : Activity() {
    companion object {
        private const val CHANNEL_ID = "amwemari_critical_security"
        private const val NOTIFICATION_ID = 45401
        private const val REQUEST_NOTIFICATIONS = 45402
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()

        val title = TextView(this).apply {
            text = "AMWEMARI SECURITY"
            textSize = 22f
            gravity = Gravity.CENTER
        }
        val status = TextView(this).apply {
            text = "Msaidizi wa usalama umefunguliwa. Tahadhari za moja kwa moja bado hazijaunganishwa."
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(12, 24, 12, 24)
        }
        val permissionButton = Button(this).apply {
            text = "Ruhusu taarifa za usalama"
            setOnClickListener { requestNotificationPermission() }
        }
        val testButton = Button(this).apply {
            text = "Jaribu sauti ya tahadhari (jaribio tu)"
            setOnClickListener {
                if (hasNotificationPermission()) {
                    showTestNotification()
                    status.text = "Taarifa ya majaribio imetumwa kwa Android. Hii si taarifa ya shambulio halisi."
                } else {
                    requestNotificationPermission()
                    status.text = "Ruhusa ya notifications inahitajika kwanza."
                }
            }
        }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(24, 32, 24, 32)
            addView(title, matchWidth())
            addView(status, matchWidth())
            addView(permissionButton, matchWidth())
            addView(testButton, matchWidth())
        }
        setContentView(root)
    }

    private fun matchWidth() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    )

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "AMWEMARI critical security alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Tahadhari muhimu za usalama wa AMWEMARI"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 250, 500, 250, 900)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun hasNotificationPermission(): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !hasNotificationPermission()) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
        }
    }

    private fun showTestNotification() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("AMWEMARI — TEST ALERT")
            .setContentText("Hili ni jaribio la mfumo wa tahadhari, si shambulio lililogunduliwa.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
            // Permission may be revoked between the check and notify call.
        }
    }
}
