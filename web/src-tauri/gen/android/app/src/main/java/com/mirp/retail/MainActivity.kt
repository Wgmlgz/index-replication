package com.mirp.retail

import android.os.Bundle
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // // Ensure content fits within system bars (disables edge-to-edge)
    // WindowCompat.setDecorFitsSystemWindows(window, true)

    // // Optional: Show system bars explicitly (if they were hidden)
    // val controller = WindowCompat.getInsetsController(window, window.decorView)
    // controller?.show(WindowInsetsCompat.Type.systemBars())

    // // Allow content to extend under the system bars
    // WindowCompat.setDecorFitsSystemWindows(window, false)

    // // Get the insets controller to manage system UI
    // val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)

    // // Hide both status bar and navigation bar
    // windowInsetsController.apply {
    //     hide(WindowInsetsCompat.Type.systemBars())
    //     systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    // }

    // // Make both bars transparent
    // window.statusBarColor = android.graphics.Color.TRANSPARENT
    // window.navigationBarColor = android.graphics.Color.TRANSPARENT

    // // Handle display cutout (notch)
    // if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
    //     window.attributes.layoutInDisplayCutoutMode = 
    //         android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    // }
  }
}
