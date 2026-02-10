"use client";

import { useState, useRef, useEffect } from "react";
import {
  Camera,
  Keyboard,
  Scan,
  HelpCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NGCApiResponse, LookupCertResponse } from "../types/ngc";
import axios from "axios";
import { mapExistingItemToNGCData } from "../types/ngc";

interface NGCEntryInterfaceProps {
  onNGCDataFound: (data: NGCApiResponse, lookup?: LookupCertResponse) => void;
  onError: (error: string) => void;
}

type EntryMode = "camera" | "manual";
type ScanState = "idle" | "scanning" | "loading" | "success" | "error";
type CameraPermission = "granted" | "denied" | "prompt";

// Configure Axios to send cookies with every request
axios.defaults.withCredentials = true;

export function NGCEntryInterface({
  onNGCDataFound,
  onError,
}: NGCEntryInterfaceProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>("camera");
  const [certNumber, setCertNumber] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [error, setError] = useState<string>("");
  const [cameraPermission, setCameraPermission] =
    useState<CameraPermission>("prompt");
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [awaitingUserGesture, setAwaitingUserGesture] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initializationRef = useRef(false); // Track initialization state

  // Initialize camera when component mounts and when entryMode changes to camera
  useEffect(() => {
    console.log("Entry mode changed to:", entryMode);

    if (entryMode === "camera" && !initializationRef.current) {
      initializationRef.current = true;
      initializeCamera();
    } else if (entryMode === "manual") {
      stopCamera();
      setAutoScanEnabled(true); // Reset auto-scan when switching to manual
      initializationRef.current = false;
    }

    return () => {
      // Only stop camera if component is unmounting, not when switching modes
      if (entryMode === "camera") {
        console.log("Cleanup: Keeping camera running for camera mode");
      }
    };
  }, [entryMode]);

  // Auto-scan when camera becomes ready
  useEffect(() => {
    if (
      entryMode === "camera" &&
      cameraPermission === "granted" &&
      cameraInitialized &&
      videoReady &&
      autoScanEnabled
    ) {
      console.log("Auto-scan triggered - camera is ready");
      // Small delay to ensure camera is fully ready
      const timer = setTimeout(() => {
        detectBarcodes();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [
    entryMode,
    cameraPermission,
    cameraInitialized,
    videoReady,
    autoScanEnabled,
  ]);

  const initializeCamera = async () => {
    try {
      setAwaitingUserGesture(false);
      setVideoReady(false);
      setError("");
      // Try back camera first with ideal resolution; fall back to any camera
      const primary: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      const fallback: MediaStreamConstraints = { audio: false, video: true };

      const attachAndPlay = async (stream: MediaStream) => {
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // iOS/Safari: ensure inline playback and muted autoplay
          video.muted = true;
          video.setAttribute("playsinline", "true");
          try {
            await video.play();
            setAwaitingUserGesture(false);
            setVideoReady(true);
          } catch (e) {
            // Some browsers require a user gesture; leave the element visible and continue
            console.warn(
              "Autoplay blocked, waiting for user gesture to start video",
              e,
            );
            setAwaitingUserGesture(true);
          }
        }
        setCameraPermission("granted");
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(primary);
        await attachAndPlay(stream);
      } catch (errPrimary) {
        console.warn(
          "Primary camera constraints failed, retrying with fallback",
          errPrimary,
        );
        // Attempt fallback constraints, and handle failure explicitly
        try {
          const stream = await navigator.mediaDevices.getUserMedia(fallback);
          await attachAndPlay(stream);
        } catch (err) {
          setCameraPermission("denied");
          setError(
            "Camera access denied or not available. Please use manual entry.",
          );
          throw err; // rethrow to go to outer catch for cleanup
        }
      }

      setCameraPermission("granted");
      setCameraInitialized(true);
      console.log("Camera initialized successfully");
    } catch (err: any) {
      console.error("Camera initialization error:", err);
      // If user denied permissions or other getUserMedia error
      if (err && err.name === "NotAllowedError") {
        setCameraPermission("denied");
        setError(
          "Camera access denied. Please allow camera permissions in your browser.",
        );
      } else {
        setCameraPermission("denied");
        setError(err?.message || "Camera access failed");
      }
      setCameraInitialized(false);
      setVideoReady(false);
      // Ensure any partially-opened stream is stopped
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((t: MediaStreamTrack) => t.stop());
        streamRef.current = null;
      }
      setAutoScanEnabled(false);
    }
  };

  const stopCamera = () => {
    console.log("Stopping camera...");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
        console.log("Stopping track:", track.kind);
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setVideoReady(false);
    setAwaitingUserGesture(false);
  };

  const resumeVideoPlayback = async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setAwaitingUserGesture(false);
      setVideoReady(true);
    } catch (err) {
      console.error("Unable to resume video playback", err);
      setError("Tap Allow to start the camera preview.");
    }
  };

  const captureImage = (options?: {
    maxWaitMs?: number;
    intervalMs?: number;
  }): Promise<string> => {
    const { maxWaitMs = 3000, intervalMs = 100 } = options || {};
    return new Promise(async (resolve, reject) => {
      try {
        const start = Date.now();

        // Wait for video element to exist and be in a usable state
        while (true) {
          // If videoRef isn't available yet, wait a bit
          if (!videoRef.current) {
            if (Date.now() - start > maxWaitMs) {
              reject(new Error("Video element not found (timeout)."));
              return;
            }
            // wait and retry
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, intervalMs));
            continue;
          }

          const video = videoRef.current;

          // Check readyState (2 = HAVE_CURRENT_DATA, 3 = HAVE_FUTURE_DATA, 4 = HAVE_ENOUGH_DATA)
          // and also ensure we have real dimensions
          if (
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.videoHeight > 0
          ) {
            // good to capture
            try {
              if (!canvasRef.current) {
                reject(new Error("Canvas element not found"));
                return;
              }
              const canvas = canvasRef.current;
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext("2d");
              if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
              }

              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              // if you want to crop or scale, do it here

              const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
              resolve(dataUrl);
              return;
            } catch (drawErr: any) {
              reject(
                new Error(
                  "Failed to capture image: " + (drawErr?.message || drawErr),
                ),
              );
              return;
            }
          }

          // if not ready yet, check timeout
          if (Date.now() - start > maxWaitMs) {
            reject(new Error("Video not ready for capture (timeout)."));
            return;
          }

          // wait before next attempt
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      } catch (err: any) {
        reject(new Error("captureImage error: " + (err?.message || err)));
      }
    });
  };

  const detectBarcodes = async (manualTrigger = false) => {
    console.log(
      "Starting barcode detection, manualTrigger:",
      manualTrigger,
      "videoReady:",
      videoReady,
    );

    // If this is a manual trigger, disable auto-scan to prevent interference
    if (manualTrigger) {
      setAutoScanEnabled(false);
    }

    // Check if camera is granted and initialized
    if (cameraPermission !== "granted" || !cameraInitialized || !videoReady) {
      console.log("Camera not ready, current state:", {
        permission: cameraPermission,
        initialized: cameraInitialized,
        videoReady: videoReady,
      });

      // If camera was initialized but video isn't ready, wait a bit
      if (cameraPermission === "granted" && cameraInitialized && !videoReady) {
        console.log("Camera initialized but video not ready, waiting...");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!videoReady) {
          const errorMsg =
            "Camera video is not ready. Please wait and try again.";
          setError(errorMsg);
          return;
        }
      } else {
        // Need to initialize camera
        await initializeCamera();
        // If still not ready after initialization, show error
        if (
          cameraPermission === "denied" ||
          !cameraInitialized ||
          !videoReady
        ) {
          const errorMsg =
            "Camera not available or not ready. Please check permissions and try again.";
          setError(errorMsg);
          return;
        }
      }
    }

    // Don't start scanning if already in progress (unless manual trigger)
    if (scanState === "scanning" || scanState === "loading") {
      console.log("Scan already in progress, skipping...");
      return;
    }

    setScanState("scanning");
    setError("");

    try {
      // Wait a moment for camera to stabilize and ensure video is playing
      console.log("Waiting for camera to stabilize...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      console.log("Attempting to capture image...");
      console.log("Video element:", videoRef.current);
      console.log("Canvas element:", canvasRef.current);
      console.log("Video readyState:", videoRef.current?.readyState);
      console.log(
        "Video dimensions:",
        videoRef.current?.videoWidth,
        "x",
        videoRef.current?.videoHeight,
      );

      const imageSrc = await captureImage();

      if (!imageSrc) {
        setScanState("error");
        const msg =
          "Could not capture image from camera. The camera might not be ready yet. Try again.";
        setError(msg);
        return;
      }

      console.log(
        "Image captured successfully, sending for barcode detection...",
      );
      setImgSrc(imageSrc);
      setScanState("loading");

      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append("image", blob, "barcode.jpg");

      console.log("Sending barcode detection request...");
      const detectionResponse = await axios.post(
        `${
          process.env.BACKEND_URL ||
          "https://www.conejocoin.net" ||
          "https://conejo-backend-146447649143.us-central1.run.app"
        }/api/v1/ngc-integration/barcodes/detect_barcode/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
          transformRequest: (data, headers) => {
            delete headers["Content-Type"];
            return data;
          },
          timeout: 30000, // 30 second timeout for barcode detection
        },
      );

      console.log("Barcode detection response:", detectionResponse.data);

      if (detectionResponse.data?.results?.length > 0) {
        const result = detectionResponse.data.results[0];

        if (result.is_duplicate && result.existing_inventory) {
          console.log("Duplicate item detected:", result);
          setScanState("success");
          setAutoScanEnabled(false); // Stop auto-scan after success

          const duplicateResponse = {
            is_duplicate: true,
            existing_inventory: result.existing_inventory,
            warning:
              result.warning ||
              "This certificate already exists in your inventory",
            ngc: result.ngc || null,
          } as LookupCertResponse;

          onNGCDataFound(result.ngc || null, duplicateResponse);

          const cert = result.existing_inventory.identification_number || "";
          if (cert) setCertNumber(cert);
          return;
        }

        const ngc = result?.ngc;

        if (!ngc) {
          setScanState("error");
          const msg =
            "Couldn't read coin data from the barcode. Try a clearer shot.";
          setError(msg);
          return;
        }

        const cert = ngc.certNumber ?? "";
        setCertNumber(cert);

        setScanState("success");
        setAutoScanEnabled(false); // Stop auto-scan after success
        onNGCDataFound(ngc);
      } else {
        setScanState("error");
        // const msg =
        //   "No barcode detected. Hold steady, fill the guide box, and try again with better lighting.";
        // setError(msg);
      }
    } catch (err: any) {
      console.error("Barcode detection error:", err);
      setScanState("error");
      const errorMsg = err.message || "Barcode detection failed";
      setError(errorMsg);
      // Don't call onError for scanning issues - they're normal
    }
  };

  const handleManualScan = () => {
    detectBarcodes(true);
  };

  const handleNGCLookup = async (certNum: string, coinData?: any) => {
    if (!certNum.trim()) {
      setError("Please enter a certificate number");
      return;
    }

    setScanState("loading");
    setError("");

    try {
      if (coinData) {
        console.log("Using coin data from barcode scan:", coinData);
        setScanState("success");
        onNGCDataFound(coinData);
        return;
      }

      console.log("Looking up NGC certificate:", certNum);
      const response = await axios.post(
        `${
          process.env.BACKEND_URL ||
          "https://www.conejocoin.net" ||
          "https://conejo-backend-146447649143.us-central1.run.app"
        }/api/v1/ngc-integration/lookup-cert/`,
        { cert_number: certNum },
        { withCredentials: true },
      );

      console.log("NGC lookup response:", response.data);

      if (response.data?.ngc) {
        setScanState("success");
        const resp = response.data as LookupCertResponse;
        onNGCDataFound(resp.ngc, resp);
      } else if (
        response.data?.is_duplicate &&
        response.data?.existing_inventory
      ) {
        setScanState("success");
        const resp = response.data as LookupCertResponse;
        console.log(
          "Duplicate found, existing inventory data:",
          resp.existing_inventory,
        );
        onNGCDataFound(null as any, resp);
      } else {
        throw new Error("Certificate not found");
      }
    } catch (err: any) {
      console.error("NGC lookup error:", err);
      setScanState("error");
      const errorMsg =
        err.response?.data?.error || err.message || "Certificate lookup failed";
      setError(errorMsg);
      onError(errorMsg);
    }
  };

  const handleManualEntry = (value: string) => {
    const withoutHyphens = value.replace(/-/g, "");
    const formatted =
      withoutHyphens.length > 7
        ? `${withoutHyphens.slice(0, 7)}-${withoutHyphens.slice(7, 10)}`
        : withoutHyphens;
    setCertNumber(formatted);
  };

  const resetScanner = () => {
    setScanState("idle");
    setError("");
    setAutoScanEnabled(true);
  };

  // Centralized mode switch
  const handleModeSwitch = (mode: EntryMode) => {
    setEntryMode(mode);
    if (mode === "manual") {
      // Stop camera when moving to manual to free resources
      stopCamera();
      setAutoScanEnabled(false);
    } else {
      // When switching back to camera, allow re-init
      initializationRef.current = false;
    }
  };

  // Force camera reinitialization when switching back to camera mode
  const handleCameraModeClick = () => {
    console.log("Camera mode clicked, current mode:", entryMode);
    if (entryMode === "camera") {
      // If already in camera mode, force reinitialization
      console.log("Force reinitializing camera...");
      initializationRef.current = false;
      initializeCamera();
    } else {
      // Switch to camera mode
      handleModeSwitch("camera");
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            {/* Make sure canvas is properly mounted and referenced */}
            <canvas
              ref={canvasRef}
              style={{ display: "none" }}
              width="1280"
              height="720"
            />

            <div className="p-6 sm:p-8 space-y-6">
              <div className="relative">
                <button
                  onClick={() => (window.location.href = "/dashboard")}
                  className="absolute left-0 top-6 -translate-y-1/2 text-sky-600 hover:text-sky-700 transition-colors"
                  aria-label="Back"
                  type="button"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="pl-9">
                  <div className="flex items-center gap-3 h-12">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600">
                        NGC
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-blue-600 border-blue-100 bg-blue-50"
                    >
                      NGC Authentication
                    </Badge>
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-900 mt-4">
                    Enter NGC Certified Coin
                  </h2>
                  <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                    Choose your preferred entry method. Use the camera for
                    instant barcode scans or switch to manual entry if the slab
                    isn't nearby.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    entryMode === "camera"
                      ? "ring-2 ring-blue-500 bg-blue-50"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={handleCameraModeClick}
                >
                  <CardContent className="p-6 text-center">
                    <Camera className="h-8 w-8 mx-auto mb-3 text-blue-600" />
                    <h3 className="font-semibold mb-1 text-slate-900">
                      Scan Barcode
                    </h3>
                    <p className="text-sm text-slate-500">Use device camera</p>
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    entryMode === "manual"
                      ? "ring-2 ring-blue-500 bg-blue-50"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => handleModeSwitch("manual")}
                >
                  <CardContent className="p-6 text-center">
                    <Keyboard className="h-8 w-8 mx-auto mb-3 text-blue-600" />
                    <h3 className="font-semibold mb-1 text-slate-900">
                      Manual Entry
                    </h3>
                    <p className="text-sm text-slate-500">Enter cert number</p>
                  </CardContent>
                </Card>
              </div>

              {entryMode === "camera" ? (
                <div className="space-y-4">
                  <div className="camera-preview relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 h-[320px] sm:h-[380px]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{
                        visibility: videoReady ? "visible" : "hidden",
                        pointerEvents: "none",
                      }}
                      onPlaying={() => {
                        console.log("Video started playing");
                        setVideoReady(true);
                      }}
                      onCanPlay={() => {
                        console.log("Video can play");
                      }}
                    />

                    <div className="scanner-overlay absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[2px]">
                      {cameraPermission === "granted" && cameraInitialized ? (
                        <div className="scanner-guide border-2 border-sky-300/90 rounded-xl w-64 h-40 md:w-80 md:h-48 relative shadow-[0_0_35px_rgba(56,189,248,0.45)]">
                          {scanState === "scanning" && (
                            <div className="scanning-line absolute w-full h-0.5 bg-sky-300 animate-pulse" />
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-white px-6">
                          <Camera className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                          {cameraPermission === "denied" && (
                            <Button
                              onClick={initializeCamera}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Allow Camera Access
                            </Button>
                          )}
                          {cameraPermission === "granted" &&
                            !cameraInitialized && (
                              <Button
                                onClick={initializeCamera}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Retry Camera
                              </Button>
                            )}
                        </div>
                      )}
                    </div>

                    {!videoReady &&
                      cameraPermission === "granted" &&
                      cameraInitialized && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <div className="text-white text-center space-y-2">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                            <p>Camera starting...</p>
                          </div>
                        </div>
                      )}

                    {awaitingUserGesture && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3 px-6 text-center">
                        <p className="text-white text-sm">
                          Tap to let your browser start the live preview.
                        </p>
                        <Button
                          onClick={resumeVideoPlayback}
                          className="bg-sky-200 text-slate-900 hover:bg-sky-100"
                        >
                          Start Camera Preview
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-slate-900 font-semibold">
                          Point camera at the barcode
                        </p>
                        <p className="text-sm text-slate-500">
                          {autoScanEnabled && scanState === "idle" && videoReady
                            ? "Auto-scan ready. Hold still and we’ll snap it."
                            : !videoReady
                              ? cameraInitialized
                                ? "Camera starting..."
                                : "Initializing camera..."
                              : "Press Scan to capture the barcode."}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {videoReady ? "Camera Ready" : "Preparing Camera"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={handleManualScan}
                        disabled={
                          scanState === "scanning" ||
                          scanState === "loading" ||
                          cameraPermission !== "granted" ||
                          !cameraInitialized ||
                          !videoReady
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white flex-1 min-w-[200px]"
                      >
                        {scanState === "scanning" ? (
                          <div>
                            <Scan className="h-5 w-5 mr-2 animate-spin" />
                            Scanning...
                          </div>
                        ) : scanState === "loading" ? (
                          <div>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Looking up...
                          </div>
                        ) : (
                          <div>
                            <Scan className="h-5 w-5 mr-2" />
                            Scan Barcode
                          </div>
                        )}
                      </Button>

                      {(scanState === "success" || scanState === "error") && (
                        <Button
                          onClick={resetScanner}
                          variant="outline"
                          className="min-w-[140px]"
                        >
                          Scan Again
                        </Button>
                      )}
                    </div>

                    <button
                      onClick={() => handleModeSwitch("manual")}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Having trouble? Switch to manual entry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
                  <div>
                    <p className="text-slate-900 font-semibold mb-1">
                      Enter certification number
                    </p>
                    <p className="text-sm text-slate-500">
                      Type the NGC certification number from the slab label.
                    </p>
                  </div>

                  <Input
                    value={certNumber}
                    onChange={(e) => handleManualEntry(e.target.value)}
                    placeholder="e.g. 12345678-001"
                    className="text-lg p-4 text-center font-mono"
                    maxLength={12}
                  />

                  <div className="flex justify-center">
                    <Button
                      onClick={() => handleNGCLookup(certNumber)}
                      disabled={scanState === "loading" || !certNumber.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-10"
                    >
                      {scanState === "loading" ? (
                        <div>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Looking up Certificate...
                        </div>
                      ) : (
                        "Look Up Certificate"
                      )}
                    </Button>
                  </div>

                  <div className="text-center text-sm text-slate-500">
                    Example cert number for testing
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => setCertNumber("6922813-006")}
                      className="text-blue-600 hover:text-blue-800 font-mono text-sm underline"
                    >
                      6922813-006
                    </button>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={handleCameraModeClick}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Use camera instead
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {scanState === "success" && (
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">
                    Certificate found! Review the details in the preview modal.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
