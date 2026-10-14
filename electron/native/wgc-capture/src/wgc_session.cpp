#include "wgc_session.h"

#include <windows.graphics.capture.interop.h>
#include <Windows.Graphics.Capture.h>
#include <inspectable.h>

#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.System.h>

#include <iostream>
#include <chrono>

// IDirect3DDxgiInterfaceAccess is a COM interface for getting the DXGI interface
// from a WinRT IDirect3DSurface
MIDL_INTERFACE("A9B3D012-3DF2-4EE3-B8D1-8695F457D3C1")
IDirect3DDxgiInterfaceAccess : public IUnknown {
    virtual HRESULT STDMETHODCALLTYPE GetInterface(REFIID iid, void** p) = 0;
};

// Convert ID3D11Device → IDirect3DDevice (WinRT interop)
extern "C" {
    HRESULT __stdcall CreateDirect3D11DeviceFromDXGIDevice(
        IDXGIDevice* dxgiDevice,
        IInspectable** graphicsDevice);
}

static int normalizeFramePoolExtent(int value) {
    int normalized = value < 2 ? 2 : value;
    if ((normalized % 2) != 0) ++normalized;
    return normalized;
}

WgcSession::WgcSession() {}

WgcSession::~WgcSession() {
    stopCapture();
}

bool WgcSession::ensureCaptureCopyTexture(int width, int height) {
    if (captureCopyTexture_) {
        D3D11_TEXTURE2D_DESC desc = {};
        captureCopyTexture_->GetDesc(&desc);
        if (static_cast<int>(desc.Width) == width && static_cast<int>(desc.Height) == height) {
            return true;
        }
        captureCopyTexture_.Reset();
    }

    D3D11_TEXTURE2D_DESC desc = {};
    desc.Width = width;
    desc.Height = height;
    desc.MipLevels = 1;
    desc.ArraySize = 1;
    desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    desc.SampleDesc.Count = 1;
    desc.Usage = D3D11_USAGE_DEFAULT;
    desc.BindFlags = D3D11_BIND_SHADER_RESOURCE;

    HRESULT hr = d3dDevice_->CreateTexture2D(&desc, nullptr, &captureCopyTexture_);
    if (FAILED(hr)) {
        std::cerr << "ERROR: Failed to create capture copy texture: 0x" << std::hex << hr << std::endl;
        return false;
    }
    return true;
}

bool WgcSession::createD3DDevice(HMONITOR targetMonitor) {
    D3D_FEATURE_LEVEL featureLevels[] = {
        D3D_FEATURE_LEVEL_11_1,
        D3D_FEATURE_LEVEL_11_0,
    };

    ComPtr<IDXGIAdapter> targetAdapter;
    if (targetMonitor) {
        MONITORINFOEXW mi = {};
        mi.cbSize = sizeof(mi);
        if (GetMonitorInfoW(targetMonitor, &mi)) {
            ComPtr<IDXGIFactory1> dxgiFactory;
            if (SUCCEEDED(CreateDXGIFactory1(IID_PPV_ARGS(&dxgiFactory)))) {
                ComPtr<IDXGIAdapter1> adapter;
                for (UINT i = 0; dxgiFactory->EnumAdapters1(i, &adapter) != DXGI_ERROR_NOT_FOUND; ++i) {
                    ComPtr<IDXGIOutput> output;
                    for (UINT j = 0; adapter->EnumOutputs(j, &output) != DXGI_ERROR_NOT_FOUND; ++j) {
                        DXGI_OUTPUT_DESC desc = {};
                        if (SUCCEEDED(output->GetDesc(&desc))) {
                            if (desc.Monitor == targetMonitor || wcscmp(desc.DeviceName, mi.szDevice) == 0) {
                                targetAdapter = adapter;
                                std::cerr << "INFO: Matched target monitor to DXGI adapter " << i << std::endl;
                                break;
                            }
                        }
                    }
                    if (targetAdapter) break;
                }
            }
        }
    }

    const D3D_DRIVER_TYPE driverType = targetAdapter ? D3D_DRIVER_TYPE_UNKNOWN : D3D_DRIVER_TYPE_HARDWARE;

    HRESULT hr = D3D11CreateDevice(
        targetAdapter.Get(),
        driverType,
        nullptr,
        D3D11_CREATE_DEVICE_BGRA_SUPPORT,
        featureLevels,
        ARRAYSIZE(featureLevels),
        D3D11_SDK_VERSION,
        &d3dDevice_,
        nullptr,
        &d3dContext_);

    if (FAILED(hr)) {
        std::cerr << "ERROR: D3D11CreateDevice failed: 0x" << std::hex << hr << std::endl;
        return false;
    }

    // Enable multithread protection on the D3D11 device
    ComPtr<ID3D11Multithread> multithread;
    if (SUCCEEDED(d3dDevice_.As(&multithread))) {
        multithread->SetMultithreadProtected(TRUE);
    }

    return true;
}

winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice WgcSession::createWinRTDevice() {
    ComPtr<IDXGIDevice> dxgiDevice;
    HRESULT hr = d3dDevice_.As(&dxgiDevice);
    if (FAILED(hr)) return nullptr;

    winrt::com_ptr<IInspectable> inspectable;
    hr = CreateDirect3D11DeviceFromDXGIDevice(dxgiDevice.Get(), inspectable.put());
    if (FAILED(hr)) return nullptr;

    return inspectable.as<winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice>();
}

winrt::Windows::Graphics::Capture::GraphicsCaptureItem WgcSession::createCaptureItemForMonitor(HMONITOR monitor) {
    auto factory = winrt::get_activation_factory<
        winrt::Windows::Graphics::Capture::GraphicsCaptureItem>();

    auto interop = factory.as<IGraphicsCaptureItemInterop>();

    winrt::Windows::Graphics::Capture::GraphicsCaptureItem item{nullptr};
    HRESULT hr = interop->CreateForMonitor(
        monitor,
        winrt::guid_of<ABI::Windows::Graphics::Capture::IGraphicsCaptureItem>(),
        winrt::put_abi(item));

    if (FAILED(hr)) {
        std::cerr << "ERROR: CreateForMonitor failed: 0x" << std::hex << hr << std::endl;
        return nullptr;
    }

    return item;
}

winrt::Windows::Graphics::Capture::GraphicsCaptureItem WgcSession::createCaptureItemForWindow(HWND hwnd) {
    auto factory = winrt::get_activation_factory<
        winrt::Windows::Graphics::Capture::GraphicsCaptureItem>();

    auto interop = factory.as<IGraphicsCaptureItemInterop>();

    winrt::Windows::Graphics::Capture::GraphicsCaptureItem item{nullptr};
    HRESULT hr = interop->CreateForWindow(
        hwnd,
        winrt::guid_of<ABI::Windows::Graphics::Capture::IGraphicsCaptureItem>(),
        winrt::put_abi(item));

    if (FAILED(hr)) {
        std::cerr << "ERROR: CreateForWindow failed: 0x" << std::hex << hr << std::endl;
        return nullptr;
    }

    return item;
}

bool WgcSession::initializeWithItem(int fps) {
    if (!captureItem_) return false;

    auto size = captureItem_.Size();
    captureWidth_ = size.Width;
    captureHeight_ = size.Height;
    framePoolWidth_ = size.Width;
    framePoolHeight_ = size.Height;

    framePool_ = winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool::CreateFreeThreaded(
        winrtDevice_,
        winrt::Windows::Graphics::DirectX::DirectXPixelFormat::B8G8R8A8UIntNormalized,
        4,
        size);

    session_ = framePool_.CreateCaptureSession(captureItem_);

    session_.IsCursorCaptureEnabled(false);

    // IsBorderRequired is only available on Windows 11+ (build 22000). propagating an hresult_error results in Native Windows capture failure
    try {
        session_.IsBorderRequired(false);
    } catch (winrt::hresult_error const&) {
    }

    return true;
}

bool WgcSession::recreateFramePoolIfNeeded(
    winrt::Windows::Graphics::SizeInt32 const& contentSize) {
    if (!framePool_) return false;

    const int normalizedWidth = normalizeFramePoolExtent(contentSize.Width);
    const int normalizedHeight = normalizeFramePoolExtent(contentSize.Height);
    if (normalizedWidth == framePoolWidth_ && normalizedHeight == framePoolHeight_) {
        return false;
    }

    winrt::Windows::Graphics::SizeInt32 normalizedSize{
        normalizedWidth,
        normalizedHeight,
    };

    try {
        framePool_.Recreate(
            winrtDevice_,
            winrt::Windows::Graphics::DirectX::DirectXPixelFormat::B8G8R8A8UIntNormalized,
            4,
            normalizedSize);
        framePoolWidth_ = normalizedWidth;
        framePoolHeight_ = normalizedHeight;
        std::cerr << "INFO: Recreated WGC frame pool for resized content "
                  << framePoolWidth_ << "x" << framePoolHeight_ << std::endl;
    } catch (winrt::hresult_error const& e) {
        fatalError_ = true;
        capturing_ = false;
        std::cerr << "ERROR: Failed to recreate WGC frame pool after resize: 0x"
                  << std::hex << e.code() << std::dec << std::endl;
    }

    return true;
}

bool WgcSession::initialize(HMONITOR monitor, int fps) {
    fps_ = fps;
    frameIntervalHns_ = 10000000LL / fps_;

    if (!createD3DDevice(monitor)) return false;

    winrtDevice_ = createWinRTDevice();
    if (!winrtDevice_) {
        std::cerr << "ERROR: Failed to create WinRT D3D device" << std::endl;
        return false;
    }

    captureItem_ = createCaptureItemForMonitor(monitor);
    return initializeWithItem(fps);
}

bool WgcSession::initialize(HWND hwnd, int fps) {
    fps_ = fps;
    frameIntervalHns_ = 10000000LL / fps_;

    HMONITOR targetMonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    if (!createD3DDevice(targetMonitor)) return false;

    winrtDevice_ = createWinRTDevice();
    if (!winrtDevice_) {
        std::cerr << "ERROR: Failed to create WinRT D3D device" << std::endl;
        return false;
    }

    captureItem_ = createCaptureItemForWindow(hwnd);
    return initializeWithItem(fps);
}

void WgcSession::setFrameCallback(FrameCallback callback) {
    frameCallback_ = std::move(callback);
}

bool WgcSession::startCapture() {
    if (!session_ || !framePool_) return false;

    capturing_ = true;
    fatalError_ = false;
    lastFrameTimeHns_ = 0;

    frameArrivedRevoker_ = framePool_.FrameArrived(
        winrt::auto_revoke,
        [this](auto const& sender, auto const& args) {
            onFrameArrived(sender, args);
        });

    session_.StartCapture();
    return true;
}

void WgcSession::stopCapture() {
    capturing_ = false;

    frameArrivedRevoker_.revoke();

    if (session_) {
        session_.Close();
        session_ = nullptr;
    }
    if (framePool_) {
        framePool_.Close();
        framePool_ = nullptr;
    }
    captureCopyTexture_.Reset();
}

void WgcSession::onFrameArrived(
    winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool const& sender,
    winrt::Windows::Foundation::IInspectable const&) {

    if (!capturing_ || fatalError_) return;

    auto frame = sender.TryGetNextFrame();
    if (!frame) return;
    auto contentSize = frame.ContentSize();
    if (recreateFramePoolIfNeeded(contentSize)) {
        frame.Close();
        return;
    }

    auto timestamp = frame.SystemRelativeTime();
    int64_t frameTimeHns = std::chrono::duration_cast<std::chrono::duration<int64_t, std::ratio<1, 10000000>>>(timestamp).count();

    // Frame rate limiting: skip frames that arrive too soon
    if (lastFrameTimeHns_ > 0 && (frameTimeHns - lastFrameTimeHns_) < (frameIntervalHns_ * 7 / 10)) {
        frame.Close();
        return;
    }
    lastFrameTimeHns_ = frameTimeHns;

    auto surface = frame.Surface();

    // Get the underlying D3D texture from the WinRT surface via COM interop
    winrt::com_ptr<IDirect3DDxgiInterfaceAccess> access;
    try {
        access = surface.as<IDirect3DDxgiInterfaceAccess>();
    } catch (...) {
        frame.Close();
        return;
    }
    ComPtr<ID3D11Texture2D> texture;
    HRESULT hr = access->GetInterface(IID_PPV_ARGS(&texture));

    if (SUCCEEDED(hr) && texture) {
        D3D11_TEXTURE2D_DESC texDesc = {};
        texture->GetDesc(&texDesc);
        if (ensureCaptureCopyTexture(static_cast<int>(texDesc.Width), static_cast<int>(texDesc.Height))) {
            d3dContext_->CopyResource(captureCopyTexture_.Get(), texture.Get());

            // Release the frame back to Direct3D11CaptureFramePool immediately
            // so DWM's composition pool is never starved across monitors!
            frame.Close();

            if (frameCallback_) {
                frameCallback_(captureCopyTexture_.Get(), frameTimeHns);
            }
            return;
        }
    }

    frame.Close();
}
