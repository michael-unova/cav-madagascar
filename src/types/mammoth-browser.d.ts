declare module 'mammoth/mammoth.browser' {
  const mammoth: {
    convertToHtml(
      input: { arrayBuffer: ArrayBuffer },
      options?: {
        convertImage?: (element: {
          read: (format: string) => Promise<ArrayBuffer>;
          contentType: string;
        }) => Promise<{ src: string }>;
      },
    ): Promise<{ value: string }>;
    images: {
      imgElement: (
        callback: (image: {
          read: (format: string) => Promise<ArrayBuffer>;
          contentType: string;
        }) => Promise<{ src: string }>,
      ) => unknown;
    };
  };
  export default mammoth;
}
