"""
U-Net for 1-3 day sea-ice concentration forecasting.

Architecture is reverse-engineered from the state_dict shapes in
weights/seaice_unet.pt so it loads with strict=True:

    enc1.0  Conv2d(5,  32, 3, padding=1)      enc1.2  Conv2d(32, 32, 3, padding=1)
    enc2.0  Conv2d(32, 64, 3, padding=1)      enc2.2  Conv2d(64, 64, 3, padding=1)
    bottleneck.0  Conv2d(64, 128, 3, padding=1)
    up2     ConvTranspose2d(128, 64, 2, stride=2)
    dec2.0  Conv2d(128, 64, 3, padding=1)     (128 = 64 upsampled + 64 skip from enc2)
    up1     ConvTranspose2d(64, 32, 2, stride=2)
    dec1.0  Conv2d(64, 32, 3, padding=1)      (64 = 32 upsampled + 32 skip from enc1)
    out     Conv2d(32, 1, 1)

Input:  (B, 5, H, W) — the last 5 daily sea-ice concentration grids stacked
        as channels (H, W must each be divisible by 4).
Output: (B, 1, H, W) — next-day concentration forecast, squashed to [0, 1].
"""
import torch
import torch.nn as nn


def _conv_block(in_ch, out_ch):
    return nn.Sequential(
        nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1),
        nn.ReLU(inplace=True),
        nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1),
        nn.ReLU(inplace=True),
    )


class SeaIceUNet(nn.Module):
    def __init__(self, in_channels: int = 5):
        super().__init__()
        self.enc1 = _conv_block(in_channels, 32)
        self.pool1 = nn.MaxPool2d(2)
        self.enc2 = _conv_block(32, 64)
        self.pool2 = nn.MaxPool2d(2)

        self.bottleneck = nn.Sequential(
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        self.up2 = nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2)
        self.dec2 = nn.Sequential(
            nn.Conv2d(128, 64, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        self.up1 = nn.ConvTranspose2d(64, 32, kernel_size=2, stride=2)
        self.dec1 = nn.Sequential(
            nn.Conv2d(64, 32, kernel_size=3, padding=1),
            nn.ReLU(inplace=True),
        )

        self.out = nn.Conv2d(32, 1, kernel_size=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        e1 = self.enc1(x)
        p1 = self.pool1(e1)
        e2 = self.enc2(p1)
        p2 = self.pool2(e2)

        b = self.bottleneck(p2)

        u2 = self.up2(b)
        d2 = self.dec2(torch.cat([u2, e2], dim=1))

        u1 = self.up1(d2)
        d1 = self.dec1(torch.cat([u1, e1], dim=1))

        return torch.sigmoid(self.out(d1))


def load_seaice_model(weights_path: str, device: str = "cpu") -> SeaIceUNet:
    """Loads weights saved via `torch.save(model, path)` OR a raw state_dict."""
    model = SeaIceUNet(in_channels=5)
    loaded = torch.load(weights_path, map_location=device, weights_only=False)

    if isinstance(loaded, nn.Module):
        model = loaded
    else:
        # loaded is an OrderedDict state_dict
        model.load_state_dict(loaded)

    model.to(device)
    model.eval()
    return model
