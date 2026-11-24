package com.zenai.samplehello

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private var count = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        val label = findViewById<TextView>(R.id.label)
        findViewById<Button>(R.id.button).setOnClickListener {
            count++
            label.text = getString(R.string.clicked, count)
        }
    }
}
