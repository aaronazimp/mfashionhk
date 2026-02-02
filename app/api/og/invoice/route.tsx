import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sku = searchParams.get("sku") || "SKU-XXX";
    const price = searchParams.get("price") || "0.00";
    const name = searchParams.get("name") || "Product Name";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFF4E5",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            padding: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "4px solid #A87C73",
              borderRadius: "20px",
              padding: "40px",
              backgroundColor: "white",
              boxShadow: "0 10px 40px rgba(168, 124, 115, 0.2)",
              width: "90%",
              height: "90%",
              position: "relative",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginBottom: 40,
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: "#A87C73",
                  letterSpacing: "4px",
                  marginBottom: 10,
                }}
              >
                付款請求
              </div>
              <div
                style={{
                  width: "60px",
                  height: "4px",
                  backgroundColor: "#A87C73",
                  borderRadius: "2px",
                }}
              />
            </div>

            {/* Product Name */}
            <div
              style={{
                fontSize: 48,
                fontWeight: "bold",
                color: "#1a1a1a",
                marginBottom: 16,
                textAlign: "center",
                maxWidth: "800px",
                lineHeight: 1.2,
              }}
            >
              {name}
            </div>

            {/* SKU */}
            <div
              style={{
                fontSize: 24,
                color: "#888",
                marginBottom: 50,
                backgroundColor: "#f5f5f5",
                padding: "8px 20px",
                borderRadius: "100px",
              }}
            >
              SKU: {sku}
            </div>

            {/* Total Amount Box */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "30px 60px",
                backgroundColor: "#FFF4E5",
                borderRadius: "20px",
                border: "2px solid #FADEC9",
              }}
            >
              <div style={{ fontSize: 20, color: "#A87C73", fontWeight: "bold", marginBottom: 5, letterSpacing: '1px' }}>
                總金額
              </div>
              <div
                style={{
                  fontSize: 80,
                  fontWeight: "bold",
                  color: "#333",
                  lineHeight: 1,
                }}
              >
                HK${price}
              </div>
            </div>

            {/* Footer brand or simple text */}
            <div
              style={{
                position: "absolute",
                bottom: 30,
                fontSize: 18,
                color: "#ccc",
              }}
            >
              通過 PayMe 安全支付
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
