import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    image: { type: String, default: "" },
    profileSetup: { type: Boolean, default: false },
    color: { type: String, default: "" },
});

const userModel = mongoose.model("User", userSchema);

export default userModel;
