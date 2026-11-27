package com.planning.oran;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Remove preferences left by the retired video-bubble feature only.
        getSharedPreferences("appointment_video_bubble", MODE_PRIVATE).edit().clear().apply();
        registerPlugin(LanDiscoveryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
