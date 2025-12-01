export function Test() {
  const handleDeleteAccountData = async () => {
    try {
      console.log("test");
    } catch (error: any) {
      console.error(error);
    } finally {
      console.log("done");
    }
  };

  const handleSaveSettings = async () => {
    console.log("save");
  };

  return null;
}
